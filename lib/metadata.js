/**
 * 加载元数据信息. 这里用的是元平台的卡片模型
 */

const { getDatabase } = require('./database');

const cache = new Map();
const ID_TYPE = 'Text';

async function loader(name) {
  if (cache.has(name)) {
    return cache.get(name);
  } else {
    const db = getDatabase();
    let { rows } = await db.execute("SELECT ID, MC, BZF, SJK FROM A_KPDY WHERE ISDEL='N' AND MC=?", [name]);
    if (rows.length == 0) throw Error(`Card ${name} is not exist`);
    let m = {
      id: rows[0].ID,
      name: rows[0].MC,
      db_name: rows[0].SJK,
      table_name: rows[0].BZF,
      fields: {},
      references: {},
    };
    let fields = await db.execute("SELECT ID, MC, BZF, LX FROM A_KPSJ WHERE ISDEL='N' AND KP_ID=?", [m.id]);
    fields.rows.forEach(row => {
      m.fields[row.MC] = {
        id: row.ID,
        name: row.MC,
        column_name: row.BZF,
        type: row.LX,
      };
    });
    let references = await db.execute("SELECT A.ID, A.MC, A.BZF, B.MC DX_MC FROM A_KPYY A, A_KPDY B WHERE A.KP_ID=? AND A.ISDEL='N' AND B.ISDEL='N' AND A.DX_ID=B.ID", [m.id]);
    references.rows.forEach(row => {
      m.references[row.MC] = {
        id: row.ID,
        name: row.MC,
        column_name: row.BZF + '_ID',
        target_name: row.DX_MC,
        type: ID_TYPE,
      };
    });
    cache.set(name, m);
    return m;
  }
}

loader.ID_TYPE = ID_TYPE;

module.exports = loader;