import axios from 'axios';

export async function integrationCreate(data: any, integrationDefinition: any) {
  const { api_key } = data;
  
  const integrationConfiguration = {
    api_key: api_key,
  };

  const payload = {
    settings: {},
    accountId: 'linear-account', // Linear doesn't have a specific account ID
    config: integrationConfiguration,
    integrationDefinitionId: integrationDefinition.id,
  };

  const integrationAccount = (await axios.post(`/api/v1/integration_account`, payload)).data;
  return integrationAccount;
}