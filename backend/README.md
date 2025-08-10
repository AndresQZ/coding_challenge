# Welcome to your CDK TypeScript project

# install AWS-CDK cli
```sh
npm install -g aws-cdk
```

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template


# How to deploy IaC with CDK

```
cdk bootstrap aws://<account-id>/<region> --profile <profile-name> --bootstrap-bucket-name <bucket-name>

cdk deploy --profile <profile-name>>

```