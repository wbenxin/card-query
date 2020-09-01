const UUID = require('uuid');
const log4js = require('@log4js-node/log4js-api');
const { getDatabase } = require('./database');
const metadata = require('./metadata');

const logger = log4js.getLogger();
const SPECIAL_FIELDS = ['ID', '记录时间', '记录账户', '记录部门', '更新时间', '更新账户', '更新部门'];


/**
 * 基于卡片模型保存数据
 * @param {array} args - 调用参数. 由三个元素组成: name, model, records.
 * name:卡片名称
 * model: 模型. 不在卡片数据或卡片引用中的元素会被忽略
 * records: 要保存地记录
 * @param {execute} 数据库执行函数
 */
async function cardw(args, execute) {
  const [name, model, records] = args;
  if (!Array.isArray(records)) throw Error('the records parameter requires an array type');

  const card = await metadata(name);

  // 预处理model参数
  if (model == null || model == '*' || model.length == 0) {
    model = Object.keys(card.fields).concat(Object.keys(card.references));
  }

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
      await execute(`INSERT INTO ${card.table_name} (${fields.join(',')},RCDAT,RCOPR_ID,RCDPT_ID,RUDAT,RUOPR_ID,RUDPT_ID) VALUES (${fields.map(() => '?').join(',')},SYSDATE(),'-','-',SYSDATE(),'-','-')`, values);
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

  // 返回保存后的数据
  return records;
}

/**
 * 基于卡片模型的多卡片数据同步保存
 * @param {*} arg1 第一个参数
 * @param  {...any} rest 剩余参数
 * @example cardw(name, model, records) or cardw([name, model, records], [name, model, records], ...)
 * @returns 单卡片使用时, 返回单个保存后records. 多卡片使用时, 按参数顺序返回每个卡片的保存后records.
 */
module.exports = async function (arg1, ...rest) {
  let args = [];
  if (Array.isArray(arg1)) {
    args = [arg1, ...rest];
  } else {
    args = [[arg1, ...rest]];
  }

  const trans_card = await metadata(args[0][0]);
  const trans_db = getDatabase(trans_card.db_name);
  if (trans_db == null) {
    throw Error(`no database named '${trans_card.db_name}'`);
  }

  let data_set = [];
  let err = await trans_db.trans(async execute => {
    for (let i = 0; i < args.length; i++) {
      let records = await cardw(args[i], execute);
      data_set.push(records);
    }
  });
  if (err) throw err;

  if (Array.isArray(arg1)) {
    return data_set;
  } else {
    return data_set[0];
  }
}
