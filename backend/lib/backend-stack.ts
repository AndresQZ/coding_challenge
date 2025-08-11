import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as path from 'path';

// This line is important for using environment variables
require('dotenv').config();



export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

   // Create the AppSync API
    const api = new appsync.GraphqlApi(this, 'NotesApi', {
      name: 'notes-api',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        },
      },
      xrayEnabled: true,
    });

     // Create the DynamoDB table for notes
    const notesTable = new dynamodb.Table(this, 'NotesTable', {
      tableName: 'notes-app-table',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Deletes table on stack destruction
    });

    // Add a Global Secondary Index (GSI) to query by sentiment
    notesTable.addGlobalSecondaryIndex({
      indexName: 'SentimentIndex',
      partitionKey: { name: 'sentiment', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dateCreated', type: dynamodb.AttributeType.STRING },
    });

    // Create a DynamoDB data source for the API
    const notesDs = api.addDynamoDbDataSource('NotesDataSource', notesTable);

    // Create the resolver for the 'createNote' mutation
    notesDs.createResolver('CreateNoteResolver', {
      typeName: 'Mutation',
      fieldName: 'createNote',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        ## Automatically generate an ID and a timestamp
        #set($id = $util.autoId())
        #set($now = $util.time.nowISO8601())

        ## Create a map for the new note, including the generated values
        #set($newNote = {})
        $util.qr($newNote.put("id", $id))
        $util.qr($newNote.put("text", $ctx.args.text))
        $util.qr($newNote.put("sentiment", $ctx.args.sentiment))
        $util.qr($newNote.put("dateCreated", $now))

        {
          "version": "2017-02-28",
          "operation": "PutItem",
          "key": {
            "id": $util.dynamodb.toDynamoDBJson($id)
          },
          "attributeValues": $util.dynamodb.toMapValuesJson($newNote)
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        `$util.toJson($ctx.result)`
      ),
    });

    // Create the resolver for the 'getNotes' query
    notesDs.createResolver('GetNotesResolver', {
      typeName: 'Query',
      fieldName: 'getNotes',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($limit = $util.defaultIfNull($ctx.args.limit, 10))

        #if($ctx.args.sentiment)
          ## If a sentiment is provided, QUERY the GSI for efficiency
          {
            "version": "2018-05-29",
            "operation": "Query",
            "index": "SentimentIndex",
            "query": {
              "expression": "sentiment = :sentiment",
              "expressionValues": {
                ":sentiment": $util.dynamodb.toDynamoDBJson($ctx.args.sentiment)
              }
            },
            "limit": $limit,
            "nextToken": #if($ctx.args.nextToken) "$ctx.args.nextToken" #else null #end
          }
        #else
          ## If no sentiment is provided, fall back to a SCAN operation on the main table
          {
            "version": "2018-05-29",
            "operation": "Scan",
            "limit": $limit,
            "nextToken": #if($ctx.args.nextToken) "$ctx.args.nextToken" #else null #end
          }
        #end
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        `$util.toJson($ctx.result)`
      ),
    });

    // 4. AWS Amplify Hosting using L1 Constructs
    const amplifyApp = new amplify.CfnApp(this, 'NotesWebApp', {
      name: 'notes-web-app',
      platform: 'WEB_COMPUTE',
       // Read repository and token from environment variables
      repository: process.env.GITHUB_REPO_URL,
      oauthToken: process.env.GITHUB_TOKEN,
      environmentVariables: [
        { name: 'NEXT_PUBLIC_GRAPHQL_URL', value: api.graphqlUrl },
        { name: 'NEXT_PUBLIC_API_KEY', value: api.apiKey || '' },
        { name: 'NEXT_PUBLIC_AWS_REGION', value: this.region },
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value:"website/notes-app-frontend" },
      ],
      // The build spec for a Next.js (Amplify Hosting Compute) app
      buildSpec: `
        version: 1
        applications:
          - appRoot: website/notes-app-frontend
            frontend:
              phases:
                preBuild:
                  commands:
                    - npm ci --cache .npm --prefer-offline
                build:
                  commands:
                    - npm run build
              artifacts:
                baseDirectory: .next
                files:
                  - '**/*'
            
      `
    });

    // Add a branch for deployment, e.g., 'main'
    new amplify.CfnBranch(this, 'mainDeployment', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      stage: 'PRODUCTION',
      framework: 'Next.js - SSR'
    });

    // 5. CDK Outputs
    new cdk.CfnOutput(this, 'GraphQLAPIURL', { value: api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphQLAPIKey', { value: api.apiKey || '' });
    new cdk.CfnOutput(this, 'AmplifyAppId', { value: amplifyApp.attrAppId });
  }
}
