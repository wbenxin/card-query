/**
 * 输出以下接口函数
 * * configure: async function - 数据库连接配置
 * * getDatabase: function - 获取数据库连接
 * * cardr: async function - 基于卡片模型查询数据
 * * cardw: async function - 基于卡片模型保存数据
 * * cardd: async function - 基于卡片模型删除数据
 * * middleware: function - koa中间件, 为ctx增加db属性
 */
const card = require('./lib/card');
const tree = require('./lib/tree');
const { configure, getDatabase } = require('./lib/database');

module.exports = {
  configure,
  getDatabase,
  middleware: () => (async (ctx, next) => {
    ctx.db = Object.assign(getDatabase, card, tree);
    await next();
  }),
  ...card,
  ...tree,
};