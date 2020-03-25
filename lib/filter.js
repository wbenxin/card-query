/**
 * 解析过滤条件
 * @param {{ 'and/or': [['三元数组']] }} filter - 过滤条件
 * @param {Map} fields - 字段列表. 模型解析的结果
 */
module.exports = function (filter, fields) {
  return logic(filter, fields);
};

function logic(obj, fields) {
  let roots = [];
  Object.keys(obj).forEach(key => {
    switch (key) {
      case 'and':
      case 'or':
        {
          let items = obj[key];
          let t = [];
          let v = [];
          items.forEach(item => {
            if (Array.isArray(item)) {
              let d = triple(item, fields);
              t.push(d.t);
              v = v.concat(d.v);
            } else {
              let d = logic(item, fields);
              t.push(`(${d.t})`);
              v = v.concat(d.v);
            }
          });
          roots.push({ t: t.join(` ${key.toUpperCase()} `), v });
          break;
        }
    }
  });
  if (roots.length > 1) {
    let t = [];
    let v = [];
    roots.forEach(d => {
      t.push(`(${d.t})`);
      v = v.concat(d.v);
    });
    return { t: t.join(' AND '), v };
  } else {
    return roots[0] || { t: null, v: [] };
  }
}

function triple(arr, fields) {
  let source = arr[0];
  let operator = arr[1];
  let value = arr[2];
  switch (operator.toUpperCase()) {
    case '=':
    case '>':
    case '<':
    case '>=':
    case '<=':
    case '<>':
      return { t: fields.get(source).column_alias + operator + '?', v: [value] };
    case 'IS':
      return { t: `${fields.get(source).column_alias} IS ${value == null ? '' : 'NOT '}NULL`, v: [] };
    case 'IN':
      return { t: `${fields.get(source).column_alias} IN (${value.map(v => '?').join(',')})`, v: value };
    case 'NOT IN':
      return { t: `${fields.get(source).column_alias} NOT IN (${value.map(v => '?').join(',')})`, v: value };
    case 'LIKE':
      return { t: `${fields.get(source).column_alias} LIKE '%${value}%'`, v: [] };
    case 'NOT LIKE':
      return { t: `${fields.get(source).column_alias} NOT LIKE '%${value}%'`, v: [] };
    case 'BETWEEN':
      return { t: `${fields.get(source).column_alias} BETWEEN ? AND ?`, v: [value[0], value[1]] };
    case 'NOT BETWEEN':
      return { t: `${fields.get(source).column_alias} NOT BETWEEN ? AND ?`, v: [value[0], value[1]] };
    default:
      throw Error('operator is not supported');
  }
}