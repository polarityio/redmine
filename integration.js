'use strict';

const request = require('request');
const async = require('async');
const fs = require('fs');
const config = require('./config/config');

let Logger;
let requestWithDefaults;

// Statuses and users are populated on the first request
let statuses = null;
let users = null;

function startup(logger) {
  Logger = logger;
  let requestOptions = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    requestOptions.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    requestOptions.key = fs.readFileSync(config.request.key);
  }

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    requestOptions.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    requestOptions.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    requestOptions.proxy = config.request.proxy;
  }

  if (typeof config.request.rejectUnauthorized === 'boolean') {
    requestOptions.rejectUnauthorized = config.request.rejectUnauthorized;
  }

  requestOptions.json = true;

  requestWithDefaults = handleRequestError(request.defaults(requestOptions));
}

function handleRequestError(request) {
  return (requestOptions, expectedStatusCode, callback) => {
    return request(requestOptions, (err, resp, body) => {
      if (err) {
        Logger.error(err, 'Error making HTTP request');
        callback({
          // Accounts for the error being a Node.js Error object which is not logged properly
          // unless you access the message and stack properties directly
          err: err instanceof Error ? { msg: err.message, stack: err.stack } : err,
          resp: resp,
          detail: 'Error making HTTP request'
        });
      } else if (resp.statusCode === expectedStatusCode) {
        callback(null, body);
      } else if (resp.statusCode === 401) {
        callback({
          detail: `You do not have permission to perform that action`,
          remediation:
            'Please confirm you have provided a valid API key and that your account has permissions to query Redmine.',
          messageType: 'alert-warning',
          body: body,
          expectedStatusCode: expectedStatusCode,
          statusCode: resp.statusCode,
          requestOptions
        });
      } else if (resp.statusCode === 404) {
        callback({
          detail: `Resource could not be found`,
          remediation: 'Please ensure the project set for your Redmine instance is valid.',
          body: body,
          expectedStatusCode: expectedStatusCode,
          statusCode: resp.statusCode,
          requestOptions
        });
      } else {
        callback({
          detail: `Unexpected status code (${resp.statusCode}) when attempting HTTP request`,
          remediation: 'Please ensure your Redmine instance is accessible.',
          body: body,
          expectedStatusCode: expectedStatusCode,
          statusCode: resp.statusCode,
          requestOptions
        });
      }
    });
  };
}

/**
 * Constructs the request options for the doLookup search request which searches Redmine for the given entity
 * @param entity
 * @param options
 * @returns {{method: string, qs: {q: string, issues: number}}}
 * @private
 */
function _getSearchRequestOptions(entity, options) {
  const requestOptions = {
    method: 'GET',
    qs: {
      q: `"${entity.value}"`,
      issues: 1, // only search issues
      limit: 10
    }
  };

  if (options.apiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  if (options.project.length > 0) {
    requestOptions.uri = `${options.url}/projects/${options.project}/search.json`;
  } else {
    requestOptions.uri = `${options.url}/search.json`;
  }

  return requestOptions;
}

function _getIssuesRequestOptions(issueId, options) {
  const requestOptions = {
    method: 'GET',
    uri: `${options.url}/issues/${issueId}.json`,
    qs: {
      include: 'relations,children,journals,attachments'
    }
  };

  if (options.apiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  return requestOptions;
}

async function doLookup(entities, options, cb) {
  let lookupResults = [];

  if (options.adminApiKey.length > 0) {
    if (statuses === null) {
      try {
        statuses = await _getStatuses(options);
        Logger.debug({ statuses }, 'Fetched Statuses');
      } catch (e) {
        Logger.error({ e }, 'Failed to fetch statuses');
        return cb(e);
      }
    }

    if (users === null) {
      try {
        users = await _getUsers(options);
        Logger.debug({ users }, 'Fetched Users');
      } catch (e) {
        Logger.error({ e }, 'Failed to fetch users');
        return cb(e);
      }
    }
  }

  async.each(
    entities,
    (entity, next) => {
      const requestOptions = _getSearchRequestOptions(entity, options);

      Logger.debug({ requestOptions }, 'Request Options');
      requestWithDefaults(requestOptions, 200, (err, body) => {
        if (err) return next(err);

        if (body.total_count > 0) {
          const issueIds = body.results.map((issue) => issue.id);
          lookupResults.push({
            entity: entity,
            data: {
              summary: [`# Issues: ${body.total_count}`],
              details: {
                issueIds
              }
            }
          });
        } else {
          lookupResults.push({
            entity: entity,
            data: null
          });
        }

        next();
      });
    },
    (err) => {
      cb(err, lookupResults);
    }
  );
}

/**
 * Returns the requested issue object
 * @param issueId
 * @param options
 * @param cb
 * @private
 */
function _getIssue(issueId, options, cb) {
  const requestOptions = _getIssuesRequestOptions(issueId, options);
  requestWithDefaults(requestOptions, 200, (err, body) => {
    if (err) cb(err);
    if (body.issue && Array.isArray(body.issue.journals)) {
      body.issue.numNotes = body.issue.journals.filter((item) => item.notes.length > 0).length;
    }
    Logger.debug({ issue: body.issue }, 'Returning Issue');
    cb(null, body.issue);
  });
}

/**
 * In the onDetails block we lookup each of the issue numbers we found in our search to get
 * more details.
 * @param lookupObject
 * @param options
 * @param cb
 */
async function onDetails(lookupObject, options, cb) {
  const issueIds = lookupObject.data.details.issueIds;
  lookupObject.data.details.issues = [];

  async.each(
    issueIds,
    (issueId, next) => {
      _getIssue(issueId, options, (err, issue) => {
        if (err) return next(err);
        lookupObject.data.details.issues.push(issue);
        next();
      });
    },
    (err) => {
      lookupObject.data.details.statuses = statuses;
      lookupObject.data.details.users = users;
      cb(err, lookupObject.data);
    }
  );
}

function _updateAssignee(options, issueId, newAssignee, oldAssignee, cb) {
  const requestUpdateOptions = {
    method: 'PUT',
    uri: `${options.url}/issues/${issueId}.json`,
    body: {
      issue: {
        assigned_to_id: newAssignee.id
      }
    }
  };

  if (options.apiKey.length > 0) {
    requestUpdateOptions.headers = {};
    requestUpdateOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  Logger.debug({ requestUpdateOptions }, 'Update Status');
  requestWithDefaults(requestUpdateOptions, 200, (err) => {
    if (err) {
      return cb(err);
    }
    _getIssue(issueId, options, (err, issue) => {
      if (err) {
        return cb(err);
      }
      // Redmine fails silently when a user attempts to update an attribute but does not have permissions
      // or the attribute cannot be updated (e.g., transitioning from one status to another that is not allowed).
      // As a result, we need to fetch the issue after updating and confirm that the attribute in question
      // has changed values.  If the value as not changed then we return an error.
      if (issue.assigned_to.id !== newAssignee.id) {
        // update failed
        cb({
          detail: `Cannot update assignee from "${oldAssignee.name}" to "${newAssignee.name}"`,
          messageType: 'alert-warning'
        });
      } else {
        cb(null, issue);
      }
    });
  });
}

function _updateStatus(options, issueId, newStatus, oldStatus, cb) {
  const requestUpdateOptions = {
    method: 'PUT',
    uri: `${options.url}/issues/${issueId}.json`,
    body: {
      issue: {
        status_id: newStatus.id
      }
    }
  };

  if (options.apiKey.length > 0) {
    requestUpdateOptions.headers = {};
    requestUpdateOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  Logger.debug({ requestUpdateOptions }, 'Update Status');
  requestWithDefaults(requestUpdateOptions, 200, (err) => {
    if (err) {
      return cb(err);
    }
    _getIssue(issueId, options, (err, issue) => {
      if (err) {
        return cb(err);
      }
      // Redmine fails silently when a user attempts to update an attribute but does not have permissions
      // or the attribute cannot be updated (e.g., transitioning from one status to another that is not allowed).
      // As a result, we need to fetch the issue after updating and confirm that the attribute in question
      // has changed values.  If the value as not changed then we return an error.
      if (issue.status.id !== newStatus.id) {
        // update failed
        cb({
          detail: `Cannot update status from "${oldStatus.name}" to "${newStatus.name}"`,
          messageType: 'alert-warning'
        });
      } else {
        cb(null, issue);
      }
    });
  });
}

function _updateIssue(options, issueId, attributeName, attributeValue, cb) {
  const requestUpdateOptions = {
    method: 'PUT',
    uri: `${options.url}/issues/${issueId}.json`,
    body: {
      issue: {}
    }
  };
  requestUpdateOptions.body.issue[attributeName] = attributeValue;

  if (options.apiKey.length > 0) {
    requestUpdateOptions.headers = {};
    requestUpdateOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  Logger.debug({ requestUpdateOptions }, 'Update Issue');
  requestWithDefaults(requestUpdateOptions, 200, (err) => {
    if (err) {
      return cb(err);
    }

    _getIssue(issueId, options, (err, issue) => {
      if(err){
        return cb(err);
      }

      if(issue[attributeName] !== attributeValue){
        return cb({
          detail: `Cannot update description.  Please check your permissions."`,
          messageType: 'alert-warning'
        });
      }

      cb(null, issue);
    });
  });
}

/**
 * Returns an array of status objects supported by the Redmine instance.
 *
 * Status objects have the format:
 *
 * {
 *    "id": 1,
 *    "name": "New",
 *    "is_closed": false
 * }
 *
 * @param options
 * @param cb
 * @private
 */
async function _getStatuses(options) {
  let requestOptions = {
    method: 'GET',
    uri: `${options.url}/issue_statuses.json`
  };

  if (options.adminApiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.adminApiKey;
  }

  const request = new Promise((resolve, reject) => {
    requestWithDefaults(requestOptions, 200, (err, result) => {
      if (err) {
        return reject(err);
      }

      if (Array.isArray(result.issue_statuses)) {
        resolve(result.issue_statuses);
      } else {
        // unexpected data
        reject({
          detail: 'Unexpected return payload when fetching issue statuses',
          result
        });
      }
    });
  });

  return request;
}

async function _getUsers(options) {
  let requestOptions = {
    method: 'GET',
    uri: `${options.url}/users.json`
  };

  if (options.adminApiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.adminApiKey;
  }

  const request = new Promise((resolve, reject) => {
    requestWithDefaults(requestOptions, 200, (err, result) => {
      if (err) {
        return reject(err);
      }

      if (Array.isArray(result.users)) {
        resolve(
          result.users.map((user) => {
            return { id: user.id, name: `${user.firstname} ${user.lastname}` };
          })
        );
      } else {
        // unexpected data
        reject({
          detail: 'Unexpected return payload when fetching users',
          result
        });
      }
    });
  });

  return request;
}

function onMessage(payload, options, cb) {
  switch (payload.action) {
    case 'UPDATE_ATTRIBUTE':
      _updateIssue(options, payload.id, payload.attributeName, payload.attributeValue, (err, issue) => {
        if (err) {
          Logger.error(
            err,
            `Error updating attribute ${payload.attributeName} with value ${payload.attributeValue} (issue #${
              payload.id
            }`
          );
        }
        cb(err, issue);
      });
      break;
    case 'UPDATE_STATUS':
      _updateStatus(options, payload.id, payload.newStatus, payload.oldStatus, (err, issue) => {
        if (err) {
          Logger.error(
            err,
            `Error updating status from ${payload.newStatus.name} to ${payload.oldStatus.name} (issue #${payload.id}`
          );
        }
        cb(err, issue);
      });
      break;
    case 'UPDATE_ASSIGNEE':
      _updateAssignee(options, payload.id, payload.newAssignee, payload.oldAssignee, (err, issue) => {
        if (err) {
          Logger.error(
            err,
            `Error updating status from ${payload.newAssignee.name} to ${payload.oldAssignee.name} (issue #${
              payload.id
            }`
          );
        }
        cb(err, issue);
      });
      break;
    default:
      cb('Invalid Action passed to onMessage');
      break;
  }
}

function validateOptions(userOptions, cb) {
  let errors = [];
  if (
    typeof userOptions.url.value !== 'string' ||
    (typeof userOptions.url.value === 'string' && userOptions.url.value.length === 0)
  ) {
    errors.push({
      key: 'url',
      message: 'You must provide your Redmine Server URL'
    });
  }

  if (typeof userOptions.url.value === 'string' && userOptions.url.value.endsWith('/')) {
    errors.push({
      key: 'url',
      message: 'The Redmine Server URL cannot end with a trailing `/`'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  onDetails: onDetails,
  onMessage: onMessage,
  validateOptions: validateOptions
};
