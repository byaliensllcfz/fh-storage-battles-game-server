# Bare Node.JS API

Barebones project to develop an API to TP Server. It already includes some of the basic funcionalities that will be common to all projects, such as verifying the X-Tapps-Shared-Cloud-Secret and sending error messages in the application/problem+json format.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

Download and install the latest LTS version of Node.js.

You can find the installer here:

```
https://nodejs.org/en/
```

Or get it from the terminal:

```
curl -sL https://deb.nodesource.com/setup_6.x | bash -
apt-get install -y nodejs
```

### Installing

After installing Node.js open a terminal, change to the folder containing the application and run the following command:

```
npm install
```

This will intall all of the package's dependencies.

## Running the application

To run the application first copy the config files to the main folder, using the following command:

```
cp -R config/dev/. .
```

After the configurations are copied, use this command to start the application:

```
sudo npm start
```

`sudo` is needed because the app writes logs to the folder: `/var/log/app_engine/custom_logs/`.
Alternatively you can also give the app permission to write on those folders.

## Running the tests

In order to run the application tests use the following command:

```
sudo npm run test
```

Tests are run using the Mocha library for Node.js and coverage reports are generated by the Istanbul library.
The results can be found inside the `coverage` folder, after the tests are run.

## Deployment

To deploy the application in App Engine copy the correct configurations into the main folder:

If the app is being deployed to the development environment:

```
cp -R config/dev/. .
```

If the app is being deployed to the production environment:

```
cp -R config/prod/. .
```

After the files have been copied login to gcloud using the CLI using:

```
gcloud auth login
```

Set the project where the application should be deployed using:

```
gcloud config set project [project-name]
```

And lastly deploy the application using:

```
gcloud app deploy
```