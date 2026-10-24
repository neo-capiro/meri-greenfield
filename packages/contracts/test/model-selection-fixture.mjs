/** Synthetic configured availability. Does not claim either model/provider is deployed or qualified. */
export const MODEL_CATALOG=Object.freeze({defaultSelection:{provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',effort:null},models:[
 {provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',label:'Synthetic Bedrock',efforts:[null,'low','high','xhigh'],available:true,unavailableReason:null},
 {provider:'claude-api',modelId:'claude-sonnet-4-6',label:'Synthetic Claude API',efforts:[null,'low','high','max'],available:true,unavailableReason:null},
 {provider:'claude-api',modelId:'synthetic-held',label:'Synthetic unavailable',efforts:[null],available:false,unavailableReason:'model_unqualified'},
]});
export const CLAUDE_SELECTION=Object.freeze({provider:'claude-api',modelId:'claude-sonnet-4-6',effort:'high'});
