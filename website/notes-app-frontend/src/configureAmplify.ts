// src/configureAmplify.ts
import { Amplify } from 'aws-amplify';

export function configureAmplify() {
  // This configuration is still valid for Amplify v6
  const awsExports = {
    "aws_project_region": process.env.NEXT_PUBLIC_AWS_REGION,
    "aws_appsync_graphqlEndpoint": process.env.NEXT_PUBLIC_GRAPHQL_URL,
    "aws_appsync_region": process.env.NEXT_PUBLIC_AWS_REGION,
    "aws_appsync_authenticationType": "API_KEY",
    "aws_appsync_apiKey": process.env.NEXT_PUBLIC_API_KEY,
  };

  Amplify.configure(awsExports, { ssr: true }); // Enable SSR support for Next.js
}