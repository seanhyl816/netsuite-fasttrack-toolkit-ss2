/**
 * Copyright Explore Consulting, LLC
 *
 * NSDAL is NetSuite Data Access Layer and provides an improved interface to netsuite records.
 * @NApiVersion 2.x
 */

///<amd-dependency path='../lodash' name="_">
///<amd-dependency path='../moment' name="moment">

import * as record from 'N/record'
import * as format from 'N/format'

import * as LogManager from '../EC_Logger'

export var log = LogManager.getLogger('nsdal')

export abstract class NetsuiteRecord {

   public static recordType: record.Type
   
   nsrecord:record.Record

   private makeRecordProp(value) {
      Object.defineProperty(this, 'nsrecord', {
         value: value,
         enumerable: false
      })
   }

    /**
     * Persists this record to the NS database
     * @param enableSourcing
     * @param ignoreMandatoryFields
     * @returns {number}
     */
   save(enableSourcing?:boolean, ignoreMandatoryFields?:boolean) {
      return this.nsrecord.save({
         enableSourcing: enableSourcing,
         ignoreMandatoryFields: ignoreMandatoryFields
      })
   }

   constructor(rec?: number | record.Record, isDynamic?:boolean, defaultValue?:Object) {
      // since the context of this.constructor is the derived class we're instantiating, using the line below we can
      // pull the 'static' recordType from the derived class and remove the need for derived classes to
      // define a constructor to pass the record type to super()
      var type = Object.getPrototypeOf(this).constructor.recordType
      if (_.isObject(rec)){
         var r = <record.Record>rec
         log.debug('using existing record', `type:${r.type}, id:${r.id}`)
         this.makeRecordProp(rec)
      }
      else if (!rec) {
         log.debug('creating new record', `type:${type}`)
         this.makeRecordProp(record.create({type: type}))
      }
      else {
         log.debug('loading existing record', `type:${type}, id:${rec}`)
         this.makeRecordProp(record.load({
            type: type,
            id: <number>rec,
            isDynamic: isDynamic || false,
            defaultValue: defaultValue
         }))
      }
   }
}

/**
 * Generic property descriptor with basic default algorithm that exposes the field value directly with no
 * other processing.
 * @returns an object property descriptor to be used
 * with Object.defineProperty
 */
function defaultDescriptor(target:any, propertyKey:string):any {
   return {
      get: function () {
         return this.nsrecord.getValue({fieldId: propertyKey})
      },
      set: function (value) {
         // ignore undefined's
         if (value !== undefined) this.nsrecord.setValue({fieldId: propertyKey, value: value})
         else log.debug(`ignoring field [${propertyKey}]`, 'field value is undefined')
      },
      enumerable: true //default is false
   };
}

/**
 * Generic property descriptor with algorithm NS checkbox to native boolean.
 */
function checkboxDescriptor(target:any, propertyKey:string):any {
   return {
      get: function () {
         return this.nsrecord.getValue({fieldId:propertyKey}) === 'T';
      },
      set: function (value) {
         // allow null to flow through, but ignore undefined's
         if (value !== undefined) this.nsrecord.setValue({
            fieldId: propertyKey,
            value: value === true ? 'T' : 'F'
         })
      },
      enumerable: true // default is false - this lets you JSON.stringify() this prop
   }
}
/**
 * Generic property descriptor with algorithm for date handling. Surfaces dates as moment() instances
 * note: does not take into account timezone 
 * @param {string} formatType the NS field type (e.g. 'date')
 * @param target
 * @param propertyKey
 * @returns  an object property descriptor to be used
 * with decorators
 */
function dateTimeDescriptor(formatType: format.Type, target:any, propertyKey:string) :any {
   return {
      get: function () {
         var value = this.nsrecord.getValue({fieldId:propertyKey})
         log.debug(`transforming field format type [${formatType}]`,`with value ${value}`)
         // ensure we don't return moments for null, undefined, etc.
         return value ? moment(format.parse({type:formatType, value:value})) : value
      },
      set: function (value) {
         // allow null to flow through, but ignore undefined's
         if (value !== undefined)
            this.nsrecord.setValue({ fieldId:propertyKey, value: value ? format.format({
               type:formatType, value:moment(value).toDate()}) : null})
         else log.debug(`not setting ${propertyKey} field`, 'value was undefined')
      },
      enumerable: true //default is false
   };
}
/**
   Netsuite field types - decorate your model properties with these to tie netsuite field types to your 
   model's field type.
 */
export namespace FieldType {
   export var freeformtext = defaultDescriptor
   export var longtext = defaultDescriptor
   export var textarea = defaultDescriptor
   export var checkbox = checkboxDescriptor
   export var multiselect = defaultDescriptor
   export var select = defaultDescriptor
   export var email = defaultDescriptor
   export var datetime = _.partial(dateTimeDescriptor, format.Type.DATETIME)
   export var date = _.partial(dateTimeDescriptor, format.Type.DATE)
   export var integernumber = defaultDescriptor
   export var decimalnumber = defaultDescriptor
   export var currency = defaultDescriptor
   export var hyperlink = defaultDescriptor
   export var image = defaultDescriptor
}