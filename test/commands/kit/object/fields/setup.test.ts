import { setFieldOptions } from '../../../../../src/commands/kit/object/fields/setup';
//import * as metadata from '../../../../../src/metadata';
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
      expect(subject('Checkbox')).toMatchObject({ defaultValue: false });
      expect(subject('Checkbox', { defaultValue: true })).toMatchObject({
        defaultValue: true,
      });
    });

    it('on update', () => {
      expect(subject('Checkbox', {}, { defaultValue: true })).toMatchObject({
        defaultValue: true,
      });
      expect(subject('Checkbox', {}, { defaultValue: false })).toMatchObject({
        defaultValue: false,
      });
      expect(
        subject('Checkbox', { defaultValue: false }, { defaultValue: true })
      ).toMatchObject({ defaultValue: false });
    });
  });

  for (const type of ['Currency', 'Number', 'Percent']) {
    describe(type, () => {
      it('on create', () => {
        expect(subject(type)).toMatchObject({ precision: 18, scale: 0 });
        expect(subject(type, { precision: 4, scale: 3 })).toMatchObject({
          precision: 4,
          scale: 3,
        });
      });

      it('on update', () => {
        expect(subject(type, {}, { precision: 4, scale: 3 })).toMatchObject({
          precision: 4,
          scale: 3,
        });
        expect(
          subject(type, { precision: 10 }, { precision: 4, scale: 3 })
        ).toMatchObject({ precision: 10, scale: 3 });
        expect(
          subject(type, { precision: 10, scale: 2 }, { precision: 4, scale: 3 })
        ).toMatchObject({ precision: 10, scale: 2 });
      });
    });
  }

  describe('Text', () => {
    it('on create', () => {
      expect(subject('Text')).toMatchObject({ length: 255 });
      expect(subject('Text', { length: 40 })).toMatchObject({ length: 40 });
    });

    it('on update', () => {
      expect(subject('Text', {}, { length: 60 })).toMatchObject({ length: 60 });
      expect(subject('Text', { length: 100 }, { length: 60 })).toMatchObject({
        length: 100,
      });
    });
  });

  describe('EncryptedText', () => {
    it('on create', () => {
      expect(subject('EncryptedText')).toMatchObject({
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
      ).toMatchObject({ length: 40, maskChar: 'X', maskType: 'creditCard' });
    });

    it('on update', () => {
      expect(
        subject(
          'EncryptedText',
          {},
          { length: 60, maskChar: 'X', maskType: 'creditCard' }
        )
      ).toMatchObject({ length: 60, maskChar: 'X', maskType: 'creditCard' });
      expect(
        subject(
          'EncryptedText',
          { length: 20, maskType: 'creditCard' },
          { length: 60, maskChar: 'asterisk' }
        )
      ).toMatchObject({
        length: 20,
        maskChar: 'asterisk',
        maskType: 'creditCard',
      });
    });
  });

  for (const type of ['LongTextArea', 'Html']) {
    describe(type, () => {
      it('on create', () => {
        expect(subject(type)).toMatchObject({
          length: 32768,
          visibleLines: 10,
        });
        expect(subject(type, { length: 5000, visibleLines: 20 })).toMatchObject(
          { length: 5000, visibleLines: 20 }
        );
      });

      it('on update', () => {
        expect(
          subject(type, {}, { length: 5000, visibleLines: 20 })
        ).toMatchObject({ length: 5000, visibleLines: 20 });
        expect(
          subject(
            type,
            { length: 3000, visibleLines: 5 },
            { length: 5000, visibleLines: 20 }
          )
        ).toMatchObject({ length: 3000, visibleLines: 5 });
      });
    });
  }

  describe('Location', () => {
    it('on create', () => {
      expect(subject('Location')).toMatchObject({ scale: 5 });
      expect(subject('Location', { scale: 3 })).toMatchObject({ scale: 3 });
    });

    it('on update', () => {
      expect(subject('Location', {}, { scale: 3 })).toMatchObject({ scale: 3 });
      expect(subject('Location', { scale: 6 }, { scale: 3 })).toMatchObject({
        scale: 6,
      });
    });
  });

  for (const type of ['Picklist', 'MultiselectPicklist']) {
    describe(type, () => {
      it('on create', () => {
        expect(subject(type, { valueSetName: 'set1' })).toMatchObject({
          valueSet: { restricted: true, valueSetName: 'set1' },
        });
        expect(
          subject(type, {
            restricted: false,
            values: 'item1;item2\nitem3 : item3_label',
          })
        ).toMatchObject({
          valueSet: {
            restricted: false,
            valueSetDefinition: {
              value: [
                { fullName: 'item1', label: 'item1' },
                { fullName: 'item2', label: 'item2' },
                { fullName: 'item3', label: 'item3_label' },
              ],
            },
          },
        });
      });

      it('on update', () => {
        expect(
          subject(
            type,
            { valueSetName: 'set2' },
            { valueSet: { restricted: false, valueSetName: 'set1' } }
          )
        ).toMatchObject({
          valueSet: { restricted: false, valueSetName: 'set2' },
        });
        expect(
          subject(
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
                    { fullName: 'item1', label: 'item1', default: true },
                    { fullName: 'item2', label: 'item2' },
                  ],
                },
              },
            }
          )
        ).toMatchObject({
          valueSet: {
            restricted: false,
            valueSetDefinition: {
              value: [
                { fullName: 'item3', label: 'item3' },
                { fullName: 'item1', label: 'item1_label', default: true },
                { fullName: 'item4', label: 'item4_label' },
              ],
            },
          },
        });
      });
    });
  }
});
