import { expect } from 'chai';
import { stubApexMethods } from '../src/apex.js';

describe('stubApexMethods', () => {
  it('stubs affected executable blocks and preserves unrelated methods', () => {
    const source = `public class Example {
  private static Schema.SObjectField classField = Account.Value__c;

  public Example() {
    Schema.SObjectField field = Account.Value__c;
  }

  public List<Account> queryRecords() {
    return [
      SELECT Id, Value__c
      FROM Account
      WHERE Value__c != null
      ORDER BY Value__c
    ];
  }

  public void updateRecord(Account record) {
    record.Value__c = 'updated';
  }

  public String value {
    get { return String.valueOf(Account.Value__c); }
    set { Account record = new Account(Value__c = value); }
  }

  public void unrelated() {
    System.debug('Value__c');
    // Value__c is mentioned in a comment.
  }

  public class Inner {
    public String value() {
      return String.valueOf(Account.Value__c);
    }
  }
}`;

    const result = stubApexMethods(source, ['Account.Value__c']);

    expect(result.changed).to.equal(true);
    expect(result.content).not.to.include('SELECT Id, Value__c');
    expect(result.content).not.to.include("record.Value__c = 'updated'");
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled method queryRecords (Value__c)'
    );
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled method updateRecord (Value__c)'
    );
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled constructor Example (Value__c)'
    );
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled getter value (Value__c)'
    );
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled setter value (Value__c)'
    );
    expect(result.content).to.include('public void unrelated()');
    expect(result.content).to.include("System.debug('Value__c');");
    expect(result.content.match(/return null;/g)).to.have.length(3);
    expect(
      result.reviews.some(
        (review) =>
          review.line === 2 &&
          review.reason.includes('outside an editable Apex method')
      )
    ).to.equal(true);
  });

  it('returns the original source and a review for invalid Apex', () => {
    const source =
      'public class Invalid { public String value( { return Account.Value__c; } }';

    const result = stubApexMethods(source, ['Account.Value__c']);

    expect(result.changed).to.equal(false);
    expect(result.content).to.equal(source);
    expect(
      result.reviews.some((review) =>
        review.reason.includes('Original Apex syntax error')
      )
    ).to.equal(true);
  });

  it('stubs methods that reference a lookup relationship with __r', () => {
    const source = `public class Example {
  public String relationshipName(Account record) {
    return record.ParentAccount__r.Name;
  }

  public List<Account> queryRelationship() {
    return [
      SELECT Id, ParentAccount__r.Name
      FROM Account
      WHERE ParentAccount__r.Name != null
    ];
  }

  public void unrelated() {
    System.debug('ParentAccount__r');
  }
}`;

    const result = stubApexMethods(source, ['Account.ParentAccount__c']);

    expect(result.changed).to.equal(true);
    expect(result.content).not.to.include('record.ParentAccount__r.Name');
    expect(result.content).not.to.include('SELECT Id, ParentAccount__r.Name');
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled method relationshipName (ParentAccount__r)'
    );
    expect(result.content).to.include(
      '// FIELD-TYPE-CHANGE: disabled method queryRelationship (ParentAccount__r)'
    );
    expect(result.content).to.include('public void unrelated()');
    expect(result.content).to.include("System.debug('ParentAccount__r');");
  });

  it('does not treat strings and comments as field references', () => {
    const source = `public class Example {
  public void log() {
    System.debug('Value__c');
    // Value__c
  }
}`;

    const result = stubApexMethods(source, ['Account.Value__c']);

    expect(result.changed).to.equal(false);
    expect(result.content).to.equal(source);
    expect(result.reviews).to.deep.equal([
      {
        reason:
          'The dependency API reported an Apex reference, but no matching field identifier was found',
      },
    ]);
  });
});
