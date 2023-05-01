import { expect } from 'chai';
import { setFieldOptions } from '../../../../../src/commands/kit/object/fields/setup';
import { CustomField } from '../../../../../src/types';

describe('setFieldOptions', () => {
  const field = (type: string, options = {}): CustomField => ({
    fullName: 'Field1__c',
    type,
    ...options,
  });
  const subject = (
    type: string,
    fieldOptions: any = {},
    existingFieldOptions: any = undefined
  ) => {
    const f = field(type, fieldOptions);
    setFieldOptions(
      f,
      existingFieldOptions && field(type, existingFieldOptions)
    );
    return f;
  };

  describe('Checkbox', () => {
    it('on create', () => {
      expect(subject('Checkbox')).to.have.property('defaultValue', false);
      expect(subject('Checkbox', { defaultValue: true })).to.have.property(
        'defaultValue',
        true
      );
    });

    it('on update', () => {
      expect(subject('Checkbox', {}, { defaultValue: true })).to.have.property(
        'defaultValue',
        true
      );
      expect(subject('Checkbox', {}, { defaultValue: false })).to.have.property(
        'defaultValue',
        false
      );
      expect(
        subject('Checkbox', { defaultValue: false }, { defaultValue: true })
      ).to.have.property('defaultValue', false);
    });
  });

  for (const type of ['Currency', 'Number', 'Percent']) {
    describe(type, () => {
      it('on create', () => {
        expect(subject(type)).to.include({ precision: 18, scale: 0 });
        expect(subject(type, { precision: 4, scale: 3 })).to.include({
          precision: 4,
          scale: 3,
        });
      });

      it('on update', () => {
        expect(subject(type, {}, { precision: 4, scale: 3 })).to.include({
          precision: 4,
          scale: 3,
        });
        expect(
          subject(type, { precision: 10 }, { precision: 4, scale: 3 })
        ).to.include({ precision: 10, scale: 3 });
        expect(
          subject(type, { precision: 10, scale: 2 }, { precision: 4, scale: 3 })
        ).to.include({ precision: 10, scale: 2 });
      });
    });
  }

  describe('Text', () => {
    it('on create', () => {
      expect(subject('Text')).to.include({ length: 255 });
      expect(subject('Text', { length: 40 })).to.include({ length: 40 });
    });

    it('on update', () => {
      expect(subject('Text', {}, { length: 60 })).to.include({ length: 60 });
      expect(subject('Text', { length: 100 }, { length: 60 })).to.include({
        length: 100,
      });
    });
  });

  describe('EncryptedText', () => {
    it('on create', () => {
      expect(subject('EncryptedText')).to.include({
        length: 175,
        maskChar: 'asterisk',
        maskType: 'all',
      });
      expect(
        subject('EncryptedText', {
          length: 40,
          maskChar: 'X',
          maskType: 'creditCard',
        })
      ).to.include({ length: 40, maskChar: 'X', maskType: 'creditCard' });
    });

    it('on update', () => {
      expect(
        subject(
          'EncryptedText',
          {},
          { length: 60, maskChar: 'X', maskType: 'creditCard' }
        )
      ).to.include({ length: 60, maskChar: 'X', maskType: 'creditCard' });
      expect(
        subject(
          'EncryptedText',
          { length: 20, maskType: 'creditCard' },
          { length: 60, maskChar: 'asterisk' }
        )
      ).to.include({
        length: 20,
        maskChar: 'asterisk',
        maskType: 'creditCard',
      });
    });
  });

  for (const type of ['LongTextArea', 'Html']) {
    describe(type, () => {
      it('on create', () => {
        expect(subject(type)).to.include({
          length: 32768,
          visibleLines: 10,
        });
        expect(subject(type, { length: 5000, visibleLines: 20 })).to.include({
          length: 5000,
          visibleLines: 20,
        });
      });

      it('on update', () => {
        expect(
          subject(type, {}, { length: 5000, visibleLines: 20 })
        ).to.include({ length: 5000, visibleLines: 20 });
        expect(
          subject(
            type,
            { length: 3000, visibleLines: 5 },
            { length: 5000, visibleLines: 20 }
          )
        ).to.include({ length: 3000, visibleLines: 5 });
      });
    });
  }

  describe('Location', () => {
    it('on create', () => {
      expect(subject('Location')).to.include({ scale: 5 });
      expect(subject('Location', { scale: 3 })).to.include({ scale: 3 });
    });

    it('on update', () => {
      expect(subject('Location', {}, { scale: 3 })).to.include({ scale: 3 });
      expect(subject('Location', { scale: 6 }, { scale: 3 })).to.include({
        scale: 6,
      });
    });
  });

  for (const type of ['Picklist', 'MultiselectPicklist']) {
    describe(type, () => {
      it('on create', () => {
        let result = subject(type, { valueSetName: 'set1' });
        expect(result.valueSet).to.include({
          restricted: true,
          valueSetName: 'set1',
        });

        result = subject(type, {
          restricted: false,
          values: 'item1;item2\nitem3 : item3_label',
        });
        expect(result.valueSet.restricted).to.be.false;
        expect(result.valueSet.valueSetDefinition.value).to.eql([
          { valueName: 'item1', label: 'item1' },
          { valueName: 'item2', label: 'item2' },
          { valueName: 'item3', label: 'item3_label' },
        ]);
      });

      it('on update', () => {
        let result = subject(
          type,
          { valueSetName: 'set2' },
          { valueSet: { restricted: false, valueSetName: 'set1' } }
        );
        expect(result.valueSet).to.include({
          restricted: false,
          valueSetName: 'set2',
        });

        result = subject(
          type,
          {
            restricted: false,
            values: 'item3;item1: item1_label\nitem4: item4_label',
          },
          {
            valueSet: {
              restricted: true,
              valueSetDefinition: {
                value: [
                  { valueName: 'item1', label: 'item1', default: true },
                  { valueName: 'item2', label: 'item2' },
                ],
              },
            },
          }
        );
        expect(result.valueSet.restricted).to.be.false;
        expect(result.valueSet.valueSetDefinition.value).to.eql([
          { valueName: 'item3', label: 'item3' },
          { valueName: 'item1', label: 'item1_label', default: true },
          { valueName: 'item4', label: 'item4_label' },
        ]);

        result = subject(
          type,
          {
            values:
              'item1: item1_label_change\nitem2_api_change: item2\n4: item4',
          },
          {
            valueSet: {
              restricted: true,
              valueSetDefinition: {
                value: [
                  { valueName: 'item1', label: 'item1', default: true },
                  { valueName: 'item2', label: 'item2' },
                  { valueName: 'item3', label: 'item3' },
                ],
              },
            },
          }
        );
        expect(result.valueSet.restricted).to.be.true;
        expect(result.valueSet.valueSetDefinition.value).to.eql([
          {
            valueName: 'item1',
            label: 'item1_label_change',
            default: true,
          },
          { valueName: 'item2_api_change', label: 'item2' },
          { valueName: '4', label: 'item4' },
          { valueName: 'item2', label: 'item2_del', isActive: false },
        ]);
      });
    });
  }
});
