const UUID = require('uuid');
const log4js = require('log4js');
const { getDatabase } = require('./database');
const metadata = require('./metadata');

const logger = log4js.getLogger();
const SPECIAL_FIELDS = ['ID', '记录时间', '记录账户', '记录部门', '更新时间', '更新账户', '更新部门'];

/**
 * 基于卡片模型保存数据
 * @param {string} name - 卡片名称
 * @param {string[]} model - 模型. 不在卡片数据或卡片引用中的元素会被忽略
 * @param {object[]} records - 要保存地记录
 */
module.exports = async function (name, model, records) {
  if (!Array.isArray(records)) throw Error('the records parameter requires an array type');

  const card = await metadata(name);
  const db = getDatabase(card.db_name);
  if (db == null) {
    logger.warn(`no database named '${card.db_name}'`);
    return;
  }
  // 预处理model参数
  if (model == null || model == '*' || model.length == 0) {
    model = Object.keys(card.fields).concat(Object.keys(card.references));
  }
  // 在事务中完成保存
  let err = await db.trans(async execute => {
    for (let i = 0; i < records.length; i++) {
      let record = records[i];
      let fields = [];
      let values = [];
      model.forEach(source => {
        if (SPECIAL_FIELDS.includes(source))
          return;
        let def = card.fields[source] || card.references[source];
        if (def) {
          fields.push(def.column_name);
          values.push(record[source]);
        }
      });
      const insert = async () => {
        fields.unshift('ID');
        values.unshift(record.ID);
        if (!fields.includes('ISDEL')) {
          fields.push('ISDEL');
          values.push('N');
        }
        await execute(`insert into ${card.table_name} (${fields.join(',')},RCDAT,RCOPR_ID,RCDPT_ID,RUDAT,RUOPR_ID,RUDPT_ID) values (${fields.map(() => '?').join(',')},SYSDATE(),'-','-',SYSDATE(),'-','-')`, values);
      };

      if (record.ID) {
        // 先更新, 如果更新了0行, 再插入
        let sets = fields.map(f => f + '=?').concat("RUDAT=SYSDATE()", "RUOPR_ID='-'", "RUDPT_ID='-'").join(',');
        let result = await execute(`UPDATE ${card.table_name} SET ${sets} WHERE ID=?`, values.concat(record.ID));
        if (result.affected == 0) {
          await insert();
        }
      } else {
        // 生成ID后插入
        record.ID = UUID.v1().replace(/-/g, '').toUpperCase();
        await insert();
      }
    }
  });
  if (err) throw err;
  // 返回保存后的数据
  return records;
}
