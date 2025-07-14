import { handleSchedule } from 'schedule';
import { integrationCreate } from './account-create';

import {
  IntegrationCLI,
  IntegrationEventPayload,
  IntegrationEventType,
  Spec,
} from '@redplanethq/sdk';

export async function run(eventPayload: IntegrationEventPayload) {
  switch (eventPayload.event) {
    case IntegrationEventType.SETUP:
      return await integrationCreate(eventPayload.eventBody, eventPayload.integrationDefinition);

    case IntegrationEventType.SYNC:
      return await handleSchedule(eventPayload.config);

    default:
      return { message: `The event payload type is ${eventPayload.event}` };
  }
}

// CLI implementation that extends the base class
class LinearCLI extends IntegrationCLI {
  constructor() {
    super('linear', '1.0.0');
  }

  protected async handleEvent(eventPayload: IntegrationEventPayload): Promise<any> {
    return await run(eventPayload);
  }

  protected async getSpec(): Promise<Spec> {
    return {
      name: 'Linear extension',
      key: 'linear',
      description:
        'Plan, track, and manage your agile and software development projects in Linear. Customize your workflow, collaborate, and release great software.',
      icon: 'linear',
      auth: {
        api_key: {
          header_name: 'Authorization',
          format: '',
        },
      },
    };
  }
}

// Define a main function and invoke it directly.
// This works after bundling to JS and running with `node index.js`.
function main() {
  const linearCLI = new LinearCLI();
  linearCLI.parse();
}

main();
