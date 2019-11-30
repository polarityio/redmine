'use strict';

const request = require('request');
const async = require('async');
const fs = require('fs');
const config = require('./config/config');

let Logger;
let requestWithDefaults;

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
      } else if (resp.statusCode !== expectedStatusCode) {
        callback({
          detail: `Unexpected status code (${resp.statusCode}) when attempting HTTP request`,
          body: body,
          expectedStatusCode: expectedStatusCode,
          statusCode: resp.statusCode
        });
      } else {
        callback(null, body);
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
      include: 'relations,children,journals,attachments,changesets'
    }
  };

  if (options.apiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  return requestOptions;
}

function doLookup(entities, options, cb) {
  let lookupResults = [];

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
 * In the onDetails block we lookup each of the issue numbers we found in our search to get
 * more details.
 * @param lookupObject
 * @param options
 * @param cb
 */
function onDetails(lookupObject, options, cb) {
  const issueIds = lookupObject.data.details.issueIds;
  lookupObject.data.details.issues = [];
  async.each(
    issueIds,
    (issueId, next) => {
      const requestOptions = _getIssuesRequestOptions(issueId, options);
      requestWithDefaults(requestOptions, 200, (err, body) => {
        if (err) cb(err);
        Logger.debug({ body }, 'onDetails request results');
        lookupObject.data.details.issues.push(body.issue);
        next(null);
      });
    },
    (err) => {
      cb(err, lookupObject.data);
    }
  );
}

function _updateIssue(options, issueId, attributeName, attributeValue, cb) {
  const requestOptions = {
    method: 'PUT',
    uri: `${options.url}/issues/${issueId}.json`,
    body: {
      issue: {}
    }
  };
  requestOptions.body.issue[attributeName] = attributeValue;

  if (options.apiKey.length > 0) {
    requestOptions.headers = {};
    requestOptions.headers['X-Redmine-API-Key'] = options.apiKey;
  }

  Logger.debug({requestOptions}, 'Update Issue');
  requestWithDefaults(requestOptions, 200, cb);
}

function onMessage(payload, options, cb) {
  switch(payload.action){
    case 'UPDATE_ATTRIBUTE':
      _updateIssue(options, payload.id, payload.attributeName, payload.attributeValue, cb);
      break;
    default:
      cb('Invalid Action passed to onMessage');
      break;
  }
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  onDetails: onDetails,
  onMessage: onMessage
};
