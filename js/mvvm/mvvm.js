// MVVM相当于Vue构造函数
function MVVM(options) {
    // 将配置对象保存到 vm ，this就是实例对象 vm
    this.$options = options;
    // 将data对象保存到vm和变量data中
    var data = this._data = this.$options.data;
    // 保存 vm 到变量 me
    var me = this;
    // 遍历data中所有属性名组成的数组
    Object.keys(data).forEach(function(key) { //key是data中的某个属性名，相当于案例中的：name
      // 对指定的属性实现代理
      me._proxy(key);
    });

    observe(data, this);

    this.$compile = new Compile(options.el || document.body, this)
}

MVVM.prototype = {
    $watch: function(key, cb, options) {
        new Watcher(this, key, cb);
    },
    // 实现指定属性代理的方法 _proxy
    _proxy: function(key) {
        var me = this;  // 保存vm到变量me
        // 给 vm 添加指定属性名的属性（注意使用的是属性描述符）
        Object.defineProperty(me, key, {
            configurable: false,  // 不能重复定义
            enumerable: true,  // 可以枚举遍历
          // 当通过vm.xxx读取属性时函数调用，从data中获取对应的属性值并返回，代理读的操作
            get: function proxyGetter() {
                return me._data[key];
            },
          //当通过vm.xxx=value时函数调用，value被保存到data中对应的属性上，代理写的操作
            set: function proxySetter(newVal) {
                me._data[key] = newVal;
            }
        });
    }
};