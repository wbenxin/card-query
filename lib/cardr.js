const log4js = require('log4js');
const { getDatabase } = require('./database');
const metadata = require('./metadata');
const filter = require('./filter');

const logger = log4js.getLogger();

/**
 * 基于卡片模型查询数据
 * @param {string} name - 卡片名称
 * @param {string[]} model - 模型
 * @param {string|number|{filter, order, rows, page}} options - 查询参数
 * * 单值类型: 代表ID的值
 * * object类型:
 * ** filter: { and/or: [ [三元组], [三元组], { and/or: [] }, ... ] } -- 过滤条件
 * ** order: { name: asc/desc } -- 排序, 默认按记录时间倒序排列, 不存在记录时间时用ID排序
 * ** rows: 100 -- 每页记录数, 为了避免意外地加载大量数据, 默认为100
 * ** page: 1 -- 页码
 */
module.exports = async function (name, model, options) {
  const card = await metadata(name);
  const db = getDatabase(card.db_name);
  if (db == null) {
    logger.warn(`no database named '${card.db_name}'`);
    return;
  }
  // 预处理model参数
  if (model == null || model == '*' || model.length == 0) {
    model = ['ID'].concat(Object.keys(card.fields), Object.keys(card.references));
  }
  if (!model.includes('ID')) model.unshift('ID');
  // 预处理options参数
  if (typeof options === 'number' || typeof options === 'string') {
    options = {
      filter: { and: [['ID', '=', options]] },
    };
  } else {
    if (Array.isArray(options.filter)) options.filter = { and: options.filter };
    options.order = options.order || {};
    options.rows = options.rows || 100;
    options.page = options.page || 1;
  }
  // 解析model
  let select = [];
  let joins = [{
    alias: 'T0',
    card: card,
    reference: null,
  }];
  let source_map = new Map();
  for (let i = 0; i < model.length; i++) {
    let source = model[i];
    let source_words = source.split(".");
    var join_cursor = joins[0];
    for (let p = 0; p < source_words.length; p++) {
      let word = source_words[p];
      if (word === 'ID') {
        select.push(`${join_cursor.alias}.ID C${i}`);
        source_map.set(source, {
          column_alias: `${join_cursor.alias}.ID`,
          column_type: metadata.ID_TYPE,
        });
        continue;
      }
      if (join_cursor.card.fields.hasOwnProperty(word)) {
        select.push(`${join_cursor.alias}.${join_cursor.card.fields[word].column_name} C${i}`);
        source_map.set(source, {
          column_alias: `${join_cursor.alias}.${join_cursor.card.fields[word].column_name}`,
          column_type: join_cursor.card.fields[word].type,
        });
        continue;
      }
      if (join_cursor.card.references.hasOwnProperty(word)) {
        if (p === source_words.length - 1) {
          // 如果是指向引用本身,则返回引用字段
          select.push(`${join_cursor.alias}.${join_cursor.card.references[word].column_name} C${i}`);
          source_map.set(source, {
            column_alias: `${join_cursor.alias}.${join_cursor.card.references[word].column_name}`,
            column_type: join_cursor.card.references[word].type
          });
        } else {
          let target_card = await metadata(join_cursor.card.references[word].target_name);
          let join = joins.find(join => {
            return join.reference === `${join_cursor.alias}.${join_cursor.card.references[word].column_name}`;
          }) || {
            alias: `T${joins.length}`,
            card: target_card,
            reference: `${join_cursor.alias}.${join_cursor.card.references[word].column_name}`,
          };
          joins.push(join);
          join_cursor = join;
        }
        continue;
      }
      throw Error(`${source} parsing failed`);
    }
  }
  // 构造左连接
  let from_sql = "";
  joins.forEach((join, index) => {
    if (index === 0)
      from_sql += join.card.table_name + " " + join.alias;
    else
      from_sql += ` LEFT JOIN ${join.card.table_name} ${join.alias} ON ${join.reference}=${join.alias}.ID`;
  });
  // 构造筛选条件
  let where = "";
  let values = [];
  if (options.filter) {
    let { t, v } = filter(options.filter, source_map);
    where = ' WHERE ' + t;
    values = v;
  }
  // 排序处理
  let order = "";
  if (options.order) {
    let a = Object.keys(options.order).map(source => {
      let v = options.order[source].toUpperCase();
      return source_map.get(source).column_alias + ' ' + (v === 'DESC' ? 'DESC' : 'ASC');
    });
    order = ' ORDER BY ' + a.join(',');
  }
  // 构造查询SQL
  let sql = `SELECT ${select.join(',')} FROM ${from_sql}` + where + order;
  // 分页处理
  if (options.rows > 0) {
    if (db.driver === 'oracle') {
      sql += ` OFFSET ${(options.page - 1) * options.rows} ROWS FETCH NEXT ${Number(options.rows)} ROWS ONLY`;
    }
    if (db.driver === 'mysql') {
      sql += ` LIMIT ${(options.page - 1) * options.rows},${Number(options.rows)}`;
    }
  }
  // 执行查询
  let { rows } = await db.execute(sql, values);
  rows.forEach(row => {
    model.forEach((source, index) => {
      row[source] = row[`C${index}`];
      delete row[`C${index}`];
    })
  });
  return rows;
}
