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
    editDescription: function(index){
      this.toggleProperty('issues.' + index + '.__editDescription');
    },
    saveDescription: function(index, id, description){
      let payload = {
        action: 'UPDATE_ATTRIBUTE',
        id: id,
        attributeName: 'description',
        attributeValue: description
      };

      this.sendIntegrationMessage(payload).then(result => {

      }).catch(err => {

      }).finally(() => {
        this.toggleProperty('issues.' + index + '.__editDescription');
      });
    }
  }
});
