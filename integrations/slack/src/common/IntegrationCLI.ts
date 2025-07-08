import { Command } from 'commander';
import { 
  IntegrationEventPayload, 
  Spec, 
  Config,
  Identifier,
  Message 
} from '@echo/core-types';

export abstract class IntegrationCLI {
  protected program: Command;
  protected integrationName: string;
  protected version: string;

  constructor(integrationName: string, version: string = '1.0.0') {
    this.integrationName = integrationName;
    this.version = version;
    this.program = new Command();
    this.setupProgram();
  }

  private setupProgram(): void {
    this.program
      .name(`${this.integrationName}-integration`)
      .description(`${this.integrationName} integration CLI`)
      .version(this.version);

    this.setupSpecCommand();
    this.setupAccountCommands();
    this.setupDataCommands();
    this.setupSyncCommand();
  }

  private setupAccountCommands(): void {
    const accountCmd = this.program
      .command('account')
      .description(`Manage ${this.integrationName} integration accounts`);

    accountCmd
      .command('create')
      .description(`Create a new ${this.integrationName} integration account`)
      .requiredOption('--oauth-response <response>', 'OAuth response JSON')
      .action(async (options) => {
        try {
          const oauthResponse = JSON.parse(options.oauthResponse);
          const integrationDefinition = JSON.parse(options.integrationDefinition);

          const result = await this.handleEvent({
            event: 'INTEGRATION_ACCOUNT_CREATED',
            eventBody: { oauthResponse },
            integrationDefinition,
          });

          console.log('Account created successfully:', JSON.stringify(result, null, 2));
        } catch (error) {
          console.error('Error creating account:', error);
          process.exit(1);
        }
      });
  }

  private setupDataCommands(): void {
    this.program
      .command('process')
      .description(`Process ${this.integrationName} integration data`)
      .requiredOption('--event-data <data>', 'Event data JSON')
      .requiredOption('--config <config>', 'Integration configuration JSON')
      .action(async (options) => {
        try {
          const eventData = JSON.parse(options.eventData);
          const config = JSON.parse(options.config);

          const result = await this.handleEvent({
            event: 'PROCESS',
            eventBody: { eventData },
            config,
          });

          const message: Message = {
            type: 'data',
            data: result
          };
          console.log(JSON.stringify(message, null, 2));
        } catch (error) {
          console.error('Error processing data:', error);
          process.exit(1);
        }
      });

    this.program
      .command('identify')
      .description('Identify webhook account')
      .requiredOption('--webhook-data <data>', 'Webhook data JSON')
      .action(async (options) => {
        try {
          const webhookData = JSON.parse(options.webhookData);

          const result = await this.handleEvent({
            event: 'IDENTIFY',
            eventBody: webhookData,
          });

          const message: Message = {
            type: 'identifier',
            data: result
          };
          console.log(JSON.stringify(message, null, 2));
        } catch (error) {
          console.error('Error identifying account:', error);
          process.exit(1);
        }
      });
  }

  private setupSpecCommand(): void {
    this.program
      .command('spec')
      .description('Get integration specification')
      .action(async () => {
        try {
          const spec = await this.getSpec();
          const message: Message = {
            type: 'spec',
            data: spec
          };
          console.log(JSON.stringify(message, null, 2));
        } catch (error) {
          console.error('Error getting spec:', error);
          process.exit(1);
        }
      });
  }

  private setupSyncCommand(): void {
    this.program
      .command('sync')
      .description('Perform scheduled sync')
      .requiredOption('--config <config>', 'Integration configuration JSON')
      .action(async (options) => {
        try {
          const config = JSON.parse(options.config);

          const result = await this.handleEvent({
            event: 'SYNC',
            eventBody: {},
            config,
          });

          const message: Message = {
            type: 'data',
            data: result
          };
          console.log(JSON.stringify(message, null, 2));
        } catch (error) {
          console.error('Error during sync:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Abstract method that must be implemented by each integration
   * This method should handle the integration-specific logic for each event type
   */
  protected abstract handleEvent(eventPayload: IntegrationEventPayload): Promise<any>;

  /**
   * Abstract method that must be implemented by each integration
   * This method should return the integration specification
   */
  protected abstract getSpec(): Promise<Spec>;

  /**
   * Parse and execute the CLI commands
   */
  public parse(): void {
    this.program.parse();
  }

  /**
   * Get the commander program instance for additional customization
   */
  public getProgram(): Command {
    return this.program;
  }
}
