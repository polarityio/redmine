# Polarity Redmine Integration

The Polarity - Redmine integration searches the Redmine open source project management application for issues containing indicators of interest.

![overlay](images/overlay.png)

| ![image](images/overlay.png) | ![image](images/notes.png) | ![image](images/status.png)
|---| --- | --- |
|*Redmine Issue Information* | *Notes* | *Updating Issue Status* |

To learn more about Redmine, please visit the [official website](https://www.redmine.org/).

> Note that this integration is currently in Beta.

## Configuring Redmine

For this integration to work, you must enable the REST API in Redmine.  To do this, you have to check `Enable REST web service` under Administration -> Settings -> API.

## Redmine Integration Options

### Redmine Server URL

The URL for your Redmine instance to include the schema (i.e., https://) and port (e.g., https://redmine:8080) as necessary

### Redmine Administrator REST APIKey

A REST API Key for your Redmine administrator. This key is used to retrieve user and status information when the integration first starts. The user information is used to populate the Assignee field of the issue. If not provided, the status and assignee fields will not be editable. The Admin API Key is not used for performing searches, editing issues, or adding notes.

> This option should be set to "Only admins can view and edit"

### Redmine REST APIKey

The REST API Key used to authenticate to your Redmine instance. If left blank, no authentication will be used when communicating with the specified Redmine instance.

You can find your API key by logging into Redmine and navigating to "My Account" and in the right hand panel slicking on "Show" API access key.

> This option should be set to "Users can view and edit" so that each Redmine user authenticates with their own account.  

### Project to Search

The name of a single project to search. If left blank, all projects will be searched.

## Redmine Limitations

- Redmine does not currently support editing or deleting an existing note via the REST API
- Redmine does not support search filtering on priority or status of an issue via the REST API

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making. For more information about the Polarity platform please see:

https://polarity.io/
