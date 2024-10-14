const accountMap = new Map();
export const start = async (context) => {
  for (const account of await context.org.connection
    .sobject('Account')
    .select('Id, Name')) {
    accountMap.set(account.Name, account.Id);
  }
};

export const convert = (row) => ({
  Text__c: row.Text,
  Number__c: row.Number,
  Checkbox__c: row.Checkbox,
  Date__c: row.Date,
  Lookup__c: accountMap.get(row.Lookup),
});
