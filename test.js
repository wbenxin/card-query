const query = require('./index');

query.configure({
  default: {
  }
});

setImmediate(async () => {
  let db = query.getDatabase();
  let res = await db.execute('select 1 from dual');
  console.log(res);
});
