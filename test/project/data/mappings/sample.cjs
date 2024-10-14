const accountMap = new Map();
exports.start = async (context) => {
  for (const account of await context.conn
    .sobject('Account')
    .select('Id, Name')) {
    accountMap.set(account.Name, account.Id);
  }
};

exports.convert = (row) => ({
  Text__c: row.Text,
  Number__c: row.Number,
  Checkbox__c: row.Checkbox,
  Date__c: row.Date,
  Lookup__c: accountMap.get(row.Lookup),
});
