'use strict';

polarity.export = PolarityComponent.extend({
  timezone: Ember.computed('Intl', function() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  issues: Ember.computed.alias('block.data.details.issues'),
  actions: {
    changeTab: function(tabName, index) {
      this.set('issues.' + index + '.__activeTab', tabName);
    },
    editDescription: function(index) {
      this.toggleProperty('issues.' + index + '.__editDescription');
    },
    saveDescription: function(index, id, description) {
      this.setBusyStatus(index, true);
      this.setError(index, '');
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
        })
        .finally(() => {
          this.toggleProperty('issues.' + index + '.__editDescription');
          this.setBusyStatus(index, false);
        });
    },
    addNote: function(index, id, note) {
      this.setError(index, '');

      if (!note || note.length === 0) {
        this.set('issues.' + index + '.__postNoteError', 'Enter a note');
        return;
      }

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
  setError(index, error) {
    let formattedError;
    if (typeof error === 'string') {
      formattedError = error;
    } else if (typeof error.detail === 'string') {
      formattedError = error.detail;
    } else {
      formattedError = JSON.stringify(error, null, 2);
    }
    this.set('issues.' + index + '.__error', error);
  }
});
