# card-query
基于卡片元数据模型的数据查询方案

## 安装
```
npm i card-query
```

## 使用
```
const query = require('card-query');

// 以下放到async函数中
await query.configure(config);
let data = await query.cardr('卡片名称', [], 'ID');
```

## 功能列表
* [async configure(config)](#configure)
* [getDatabase(name)](#getDatabase)
* [async cardr(name, model, options)](#cardr)
* [async cardw(name, model, records)](#cardw)
* [async cardd(name, ids)](#cardd)
* [middleware()](#middleware)

## <a name="configure">async configure(config)</a>
配置数据库连接参数. 支持Oracle和Mysql两种数据库.
该函数是异步的, 返回一个Promise对象.

### @ config参数
```
{
  [name]: {
    driver: '',       // 'oracle'或者'mysql'
    connectString: 'localhost/orcl',    // oracle专用
    host: '',         // mysql专用
    database: '',     // mysql专用
    user: '',         // 用户名
    password: '',     // 密码
  }
}
```
> 至少要有一个name为'default'的连接. 加载元数据会使用该连接

更多配置项请参考[oracledb](https://oracle.github.io/node-oracledb/doc/api.html)或[mysql2](https://github.com/sidorares/node-mysql2/blob/master/README.md)

### @ 返回值
`Promise<null>`

## <a name="getDatabase">getDatabase(name)</a>
获取指定名称的数据库连接对象

### @ name参数
对应出现在config中的name

### @ 返回值
根据连接的数据库类型, 可能为Oracle或者Mysql对象的实例. 两者都具有如下属性:
* driver
  * 只读属性, 取值为`'oracle'`或者`'mysql'`
  * 可以用来判断连接的数据库类型
* async getConnection()
  * 这是用来访问`oracledb`和`mysql2`的连接对象的, 一般不推荐使用
  * 这个方法从连接池中获取一个连接对象. 如果是Oracle数据库, 连接对象是`oracledb`提供的. 如果是MySQL数据库, 连接对象是`mysql2`提供的.
  * 获取的连接, 用完后需要归还给连接池. 两个数据库的归还接口不一样, Oracle数据库需要调用`conn.close()`方法, MySQL数据库需要调用`conn.release()`方法.
  ```
  let db = getDatabase('AmyDB');
  let conn = await db.getConnection();
  conn.execute('select 1 from dual');
  conn.close(); // 如果是mysql则需要用conn.release()
  ```
* async execute(sql, values = [])
  * 执行一个SQL语句
  * 支持以 `?` 表达的参数化查询. 比如: `execute('select ? from dual', [1])` . 如果是Oracle数据库, 会自动将 `?` 转为 `:` 格式
  * 参数是数组格式. 顺序与sql文本中 `?` 出现的顺序一致
* async trans(callback)
  * 启动一个事务, 然后执行 `callback` 指定的回调函数. 如果没有错误发生, 则提交事务. 如果抛出了异常, 则回滚事务.
  * 如果成功提交了, 则返回`Promise<null>`, 如果失败回滚了, 则返回`Promise<Error>`
* format_result(result)
  * 用来将`oracledb`和`mysql2`的SQL结果集规范化到统一的格式: { rows, fields, affected, insertId }
    * rows: 返回的行数组
    * fields: 每个列的类型描述
    * affected: 影响的行数
    * insertId: 插入的ID. 如果是自增ID, 可以从这里拿到插入后生成的ID

## <a name="cardr">async cardr(name, model, options)</a>
提供基于卡片的数据查询功能

### @ name参数: string
卡片名称

### @ model参数: string[]
字段的数组. 可以用 `.` 多级连接引用的字段. 以下都是合法的写法:
```
['名称', '描述', '上级.名称', '持有人.所属部门.名称']
```
> 不需要显式添加 'ID' 字段
> 
> 特殊地, 如果model参数传递 `'*'`, `[]`, `null`, `undefined` 表示使用卡片的全部字段(卡片数据+卡片引用).

### @ options参数: string | number | object
可以传递一个ID值, 来直接查询对应ID的单条记录.

支持以下属性
* filter  - 筛选条件
* order   - 排序
* rows    - 每页行数
* page    - 页码

#### filter
> 格式为 { 'and/or': [ [三元组], { 'and/or': [] }, ... ] }

> 特殊地, 也支持 [ [三元组], { 'and/or': [] } ... ] 格式. 默认为 `and` 连接

其中, `[三元组]` 表示一个形如 `[a,b,c]` 由三个元素组成的数组. 第一个元素是字段名(model数组中的元素), 第二个元素是比较运算符, 第三个元素是值.

支持的比较运算符有:
```
=, <>, >, >=, <, <=
IS
IN, NOT IN
LIKE, NOT LIKE
BETWEEN, NOT BETWEEN
```

如果是 `IN`, `BETWEEN` 这样需要多个参数值的情况, 第三个元素要传递一个数组类型. 比如 `['序号', 'BETWEEN', [100,200]]`

#### order
> 格式为 { '字段名': 'asc/desc', ... }

字段名是model数组中的元素

如果未提供此参数, 则默认为model中的 `'记录时间'` 降序. 如果model中没有 `'记录时间'`, 就默认为 `'ID'` 升序

#### rows
如果不指定该参数, 或者指定为0, 都会被强制覆盖为默认的100. 这是为了避免一次性加载海量数据从而导致node因达到内存上限而崩溃.

如果确实需要一次性加载大量数据, 可以指定一个足够大的数值. 

> 最佳实践是少量多次加载数据, 并且每次加载后根据rows和返回的行数是否相等来判断还有没有下一页数据等待加载.

#### page
请求的页码, 默认为 1

### @ 返回值
数组类型, 查询到的所有记录

## <a name="cardw">async cardw(name, model, records)</a>
提供基于卡片的数据保存功能

### @ name参数
卡片名称

### @ model参数
请参考 `cardr` 中的model参数

### @ records参数
要保存到数据库的记录数组

所有记录都会在一个事务中处理, 要么都成功, 要么都失败.

### @ 返回值
返回经过修改的records参数:
> 如果记录没有指定ID, 则自动在插入数据库时生成新的ID并更新到记录上

## <a name="cardd">async cardd(name, ids)</a>
提供基于卡片的数据删除功能

### @ name参数
卡片名称

### @ ids参数
类型为 string[]

要删除记录的ID数组

### @ 返回值
类型为 string[]

删除成功了的ID数组

## <a name="middleware">middleware()</a>
提供koa中间件支持. 调用后会返回一个koa中间件, 用来为ctx对象增加db属性. 可以通过db属性访问所有的功能.

```
const App = require('koa');
const query = require('card-query');

// 初始化数据库连接配置
query.configure(config);

const app = new App();
// 引入中间件
app.use(query.middleware());

app.use(async (ctx, next) => {
  // 执行SQL
  let d = await ctx.db('conn_name').execute('select * from user where id=?', [123]);

  // 调用cardr接口获取卡片的数据
  let data = await ctx.db.cardr('some card', [], 'some id');
  // 输出到浏览器
  ctx.body = JSON.stringify(data);
});

app.listen(3000);
```