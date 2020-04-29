const log4js = require('@log4js-node/log4js-api');
const { getDatabase } = require('./database');
const metadata = require('./metadata');

const logger = log4js.getLogger();

/**
 * 基于卡片模型删除记录及其所有子记录
 * 
 * 会基于[ID路径]字段,来删除所有子节点
 * 
 * @param {string} name - 卡片名称
 * @param {string[]} ids - 要删除记录的ID数组
 */
module.exports = async function (name, ids) {
  const card = await metadata(name);
  const db = getDatabase(card.db_name);
  if (db == null) {
    logger.warn(`no database named '${card.db_name}'`);
    return;
  }
  let like = db.driver === 'mysql' ? "CONCAT('%',?,'%')" : "'%'||?||'%'";
  let deleted_ids = [];
  let err = await db.trans(async execute => {
    await Promise.all(ids.map(async id => {
      try {
        let { affected } = await execute(`DELETE FROM ${card.table_name} WHERE ID=? OR IDLJ LIKE ${like}`, [id, id]);
        if (affected > 0) deleted_ids.push(id);
      } catch (e) { }
    }));
  });
  if (err) throw err;
  return deleted_ids;
};