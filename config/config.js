module.exports = {
  name: 'Redmine',
  acronym: 'RED',
  description: 'Searches issues for supported indicators in the Redmine Project management software',
  entityTypes: ['IPv4', 'MD5', 'SHA1', 'SHA256', 'domain', 'email'],
  logging: { level: 'info' },
  block: {
    component: {
      file: './components/redmine.js'
    },
    template: {
      file: './templates/redmine.hbs'
    }
  },
  defaultColor: 'light-purple',
  styles: ['./styles/redmine.less'],
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: ''
  },
  options: [
    {
      key: 'url',
      name: 'Redmine Server URL',
      description:
        'The URL for your Redmine instance to include the schema (i.e., https://) and port (e.g., https://redmine:8080) as necessary',
      type: 'text',
      default: '',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'adminApiKey',
      name: 'Redmine Administrator REST API Key',
      description:
        'A REST API Key for your Redmine administrator.  This key is used to retrieve user and status information when the integration first starts. The user information is used' +
        ' to populate the Assignee field of the issue.  If not provided, the status and assignee fields will not be editable.  The Admin API Key is not used for performing searches,' +
        ' editing issues, or adding notes.  >> Please restart the integration after modifying this option.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiKey',
      name: 'Redmine User REST API Key',
      description:
        'The REST API Key used to authenticate to your Redmine instance. If left blank, no authentication will be used when communicating with the specified Redmine instance',
      default: '',
      type: 'password',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'project',
      name: 'Project to Search',
      description:
        'The name of a single project to search.  If left blank, all projects will be searched.  Project name should be all lowercase with dashes in place of spaces.',
      default: '',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    }
  ]
};
