const log4js = require('@log4js-node/log4js-api');
const cardr = require('./cardr');

const logger = log4js.getLogger();

/**
 * 基于卡片模型查询树型数据
 * 
 * 数据基于cardr来加载, 然后组织成通过children级联的树型数据
 * 
 * @param {string} name - 卡片名称
 * @param {string[]} model - 模型
 * @param {string} parent - 上级引用的名称
 * @param {string|number|{filter, order, rows, page}} options - 查询参数
 * * 单值类型: 代表ID的值
 * * object类型:
 * ** root: { <name>: value } -- 根节点匹配条件
 * ** filter: { and/or: [ [三元组], [三元组], { and/or: [] }, ... ] } -- 过滤条件
 * ** order: { <name>: asc/desc } -- 排序, 默认按记录时间倒序排列, 不存在记录时间时用ID排序
 * ** rows: 100 -- 每页记录数, 为了避免意外地加载大量数据, 默认为100
 * ** page: 1 -- 页码
 */
module.exports = async function (name, model, parent, options) {
  if (!model.includes(parent)) {
    model.push(parent);
    logger.warn('treer: the model parameter does not contain the parent field and has been automatically fixed');
  }

  let card_data = await cardr(name, model, options);

  let node_map = {};
  card_data.forEach(record => node_map[record.ID] = record);

  let roots = [];
  card_data.forEach(record => {
    let parentId = record[parent];
    if (node_map[parentId]) {
      node_map[parentId].children = node_map[parentId].children || [];
      node_map[parentId].children.push(record);
    } else {
      if (!options.root) roots.push(record);
    }
    if (options.root) {
      let match = true;
      for (let p in options.root) {
        match = match && (options.root[p] == record[p]);
      }
      if (match) roots.push(record);
    }
  });

  return roots;
}
