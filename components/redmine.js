'use strict';

polarity.export = PolarityComponent.extend({
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  statuses: Ember.computed.alias('block.data.details.statuses'),
  users: Ember.computed.alias('block.data.details.users'),
  issues: Ember.computed.alias('block.data.details.issues'),
  enableEditing: Ember.computed.alias('block.data.details.enableEditing'),
  isUpdating: false,
  tmpUpdateValue: '',
  actions: {
    closeError: function(index) {
      this.set('issues.' + index + '.__error', '');
    },
    changeTab: function(tabName, index) {
      this.set('issues.' + index + '.__activeTab', tabName);
    },
    showUpdateModal: function(show, fieldName, fieldValue, index) {
      this._closeAllModals();
      this.set('tmpUpdateValue', fieldValue);
      // console.info(`issues.${index}.__showUpdateModal: ${show}`);
      this.set(`issues.${index}.__showUpdateModal`, show);
      this.set('updateFieldName', fieldName);
      // console.info("Notify property change");
      this.get('block').notifyPropertyChange('data');
    },
    updateAttribute: function(issue, type, value, issueIndex) {
      this.clearError(issueIndex);
      if (type === 'status') {
        this._updateStatus(issue, value, issueIndex);
      } else if (type === 'assignee') {
        this._updateAssignee(issue, value, issueIndex);
      }
    },
    editDescription: function(index) {
      this.toggleProperty('issues.' + index + '.__editDescription');
    },
    saveDescription: function(index, id, description) {
      this.setBusyStatus(index, true);
      this.clearError(index);
      let payload = {
        action: 'UPDATE_ATTRIBUTE',
        id: id,
        attributeName: 'description',
        attributeValue: description
      };

      this.sendIntegrationMessage(payload)
        .then((issue) => {
          this.set('issues.' + index + '.description', issue.description);
        })
        .catch((err) => {
          this.setError(index, err);
          this._refreshIssue(id, index, 'description');
        })
        .finally(() => {
          this.toggleProperty('issues.' + index + '.__editDescription');
          this.setBusyStatus(index, false);
        });
    },
    addNote: function(index, id, note) {
      if (!note || note.length === 0) {
        this.set('issues.' + index + '.__postNoteError', 'Enter a note');
        return;
      }

      this.clearError(index);

      this.setBusyStatus(index, true);
      this.set('issues.' + index + '.__postNoteError', '');

      let payload = {
        action: 'UPDATE_ATTRIBUTE',
        id: id,
        attributeName: 'notes',
        attributeValue: note
      };

      this.sendIntegrationMessage(payload)
        .then((issue) => {
          this.set('issues.' + index + '.journals', issue.journals);
          this.set('issues.' + index + '.numNotes', issue.numNotes);
        })
        .catch((err) => {
          this.setError(index, err);
        })
        .finally(() => {
          this.set('issues.' + index + '.__note', '');
          this.setBusyStatus(index, false);
        });
    }
  },
  setBusyStatus(index, status) {
    this.set('issues.' + index + '.__busy', status);
  },
  clearError(index) {
    this.set('issues.' + index + '.__error', null);
  },
  setError(index, error) {
    let formattedError;
    let type = 'alert-danger';
    if (typeof error === 'string') {
      formattedError = error;
    } else if (error.meta && typeof error.meta.detail === 'string') {
      formattedError = error.meta.detail;
      type = error.meta.messageType ? error.meta.messageType : 'alert-danger';
    } else if (typeof error.detail === 'string') {
      formattedError = error.detail;
      type = error.messageType ? error.messageType : 'alert-danger';
    } else {
      formattedError = JSON.stringify(error, null, 2);
    }
    this.set('issues.' + index + '.__error', {
      message: formattedError,
      type
    });
  },
  _closeAllModals() {
    console.info('Closing all modals');
    let numIssues = this.get('issues.length');
    for (let i = 0; i < numIssues; i++) {
      this.set(`issues.${i}.__showUpdateModal`, false);
    }
  },
  _updateStatus: function(issue, status, issueIndex) {
    let self = this;

    this.set('isUpdating', true);
    // The payload can contain any properties as long as you send a javascript object literal (POJO)

    let payload = {
      action: 'UPDATE_STATUS',
      id: issue.id,
      newStatus: status,
      oldStatus: issue.status
    };

    // This is a utility method that will send the payload to the server where it will trigger the integration's `onMessage` method
    this.sendIntegrationMessage(payload)
      .then(function(issue) {
        self.set('issues.' + issueIndex + '.status', issue.status);
      })
      .catch((err) => {
        self.setError(issueIndex, err);
      })
      .finally(() => {
        self.set(`issues.${issueIndex}.__showUpdateModal`, false);
        self.set('isUpdating', false);
        self.get('block').notifyPropertyChange('data');
      });
  },
  _updateAssignee: function(issue, user, issueIndex) {
    let self = this;

    this.set('isUpdating', true);
    // The payload can contain any properties as long as you send a javascript object literal (POJO)

    let payload = {
      action: 'UPDATE_ASSIGNEE',
      id: issue.id,
      newAssignee: user,
      oldAssignee: issue.assigned_to
    };

    // This is a utility method that will send the payload to the server where it will trigger the integration's `onMessage` method
    this.sendIntegrationMessage(payload)
      .then(function(issue) {
        self.set('issues.' + issueIndex + '.assigned_to', issue.assigned_to);
      })
      .catch((err) => {
        self.setError(issueIndex, err);
      })
      .finally(() => {
        self.set(`issues.${issueIndex}.__showUpdateModal`, false);
        self.set('isUpdating', false);
        self.get('block').notifyPropertyChange('data');
      });
  },
  _refreshIssue: function(issueId, issueIndex, field) {
    this.setBusyStatus(issueIndex, true);

    let payload = {
      action: 'REFRESH_ISSUE',
      id: issueId
    };

    this.sendIntegrationMessage(payload)
      .then((issue) => {
        this.set('issues.' + issueIndex + '.' + field, issue[field]);
      })
      .catch((err) => {
        this.setError(issueIndex, err);
      })
      .finally(() => {
        this.setBusyStatus(issueIndex, false);
        this.get('block').notifyPropertyChange('data');
      });
  }
});
