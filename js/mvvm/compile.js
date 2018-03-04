/* 编译/解析模版的Compile函数 */
function Compile(el, vm) { // 注意这里传的el是个字符串 '#test'
    // 这里this是Compile的实例对象compile，将vm保存到compile对象中
    this.$vm = vm;
    // 将el对应的元素对象保存到compile对象中，注意这里el是字符串不是元素节点，所以通过后面的方法获取到el
    this.$el = this.isElementNode(el) ? el : document.querySelector(el);
    // 如果存在el元素
    if (this.$el) {
        // 1、取出el中所有子节点保存到内存的fragment对象中
        this.$fragment = this.node2Fragment(this.$el);  // 注意这里的 2 代表的是to的简写
        // 2、初始化显示：编译fragment中所有层次子节点，注意此时页面未显示内容
        this.init();
        // 3、将编译好的fragment添加到页面的el元素中，此时页面才会显示内容
        this.$el.appendChild(this.$fragment);
    }
}

Compile.prototype = {
    node2Fragment: function(el) {
        // 在内存中创建一个空的fragment容器对象
        var fragment = document.createDocumentFragment(),
            child;
        // 将el中所有子节点转移到fragment对象中
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }
        // 返回fragment对象
        return fragment;
    },

    init: function() {
        // 编译指定元素（所有层次的子节点）
        this.compileElement(this.$fragment);
    },

    compileElement: function(el) {
        // 取出最外层所有子节点
        var childNodes = el.childNodes,
            me = this;  // 保存compile对象到变量me
        // 将伪数组转换为真数组，并遍历所有子节点（包括元素节点和文本节点）
        [].slice.call(childNodes).forEach(function(node) {
            // 得到节点的文本内容
            var text = node.textContent;
            // 创建正则对象（匹配大括号表达式的） . 表示任意一个，*表示任意多个，
            var reg = /\{\{(.*)\}\}/;   // 小括号括起来，表示子匹配，匹配到子节点
            // 判断节点是否是一个元素节点
            if (me.isElementNode(node)) {
                // 编译节点（解析指令属性）
                me.compile(node);
            // 判断节点是否是大括号格式的文本节点
            } else if (me.isTextNode(node) && reg.test(text)) {
                // 编译大括号表达式的文本节点
                me.compileText(node, RegExp.$1);
            }
            // 如果当前节点还有子节点，通过递归调用实现所有层次节点的编译
            if (node.childNodes && node.childNodes.length) {
                me.compileElement(node);
            }
        });
    },

    compile: function(node) {
        //得到标签中所有的属性
        var nodeAttrs = node.attributes,
            // 保存compile对象到变量 me
            me = this;
        // 遍历所有属性
        [].slice.call(nodeAttrs).forEach(function(attr) {
            // 得到属性名，对应案例中的：v-on:click
            var attrName = attr.name;
            // 判断是否是指令属性
            if (me.isDirective(attrName)) {
                //得到属性值，即表达式：show
                var exp = attr.value;
                // 从属性名中得到指令名：on-click
                var dir = attrName.substring(2);  // substring(2)提取字符串中下标为2的字符串
                // 判断是否是事件指令
                if (me.isEventDirective(dir)) {
                    // 解析处理事件指令
                    compileUtil.eventHandler(node, me.$vm, exp, dir);
                    // 普通指令
                } else {
                    // 编译指令属性
                    compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
                }
                // 移除指令属性
                node.removeAttribute(attrName);
            }
        });
    },

    compileText: function(node, exp) {
        compileUtil.text(node, this.$vm, exp);
    },

    isDirective: function(attr) {
        //indexOf() 方法可返回某个指定的字符串值在字符串中首次出现的位置。
        return attr.indexOf('v-') == 0;
    },

    isEventDirective: function(dir) {
        return dir.indexOf('on') === 0;
    },

    isElementNode: function(node) {
        return node.nodeType == 1;
    },

    isTextNode: function(node) {
        return node.nodeType == 3;
    }
};

// 包含多个解析指令的方法的工具对象
var compileUtil = {
    // 解析 v-text/{{}}指令
    text: function(node, vm, exp) {
        this.bind(node, vm, exp, 'text');
    },
  // 解析 v-html指令
    html: function(node, vm, exp) {
        this.bind(node, vm, exp, 'html');
    },
  // 解析 v-model指令
    model: function(node, vm, exp) {
        // 实现数据的初始化显示和创建对应的watcher
        this.bind(node, vm, exp, 'model');
        var me = this,
            // 得到表达式的值
            val = this._getVMVal(vm, exp);
        //给节点绑定input事件监听（输入改变时调用）
        node.addEventListener('input', function(e) {
            // 得到输入的最新的值
            var newValue = e.target.value;
            // 如果没有变化，则直接结束
            if (val === newValue) {
                return;
            }
            //将最新的值value保存给表达式所对应的属性
            me._setVMVal(vm, exp, newValue);
            //保存最新的值
            val = newValue;
        });
    },
  // 解析 v-class指令（平常用的是:class/v-bind:class没有v-class的，这里是为了方便设计的）
    class: function(node, vm, exp) {
        this.bind(node, vm, exp, 'class');
    },

    bind: function(node, vm, exp, dir) {
        //得到更新节点的函数
        var updaterFn = updater[dir + 'Updater'];
        // 调用函数更新节点
        updaterFn && updaterFn(node, this._getVMVal(vm, exp));

        // 为表达式创建一个对应的watcher,实现节点的更新显示
        new Watcher(vm, exp, function(value, oldValue) { // 当表达式对应的任意一个属性变化时调用
           // 更新界面中的指定节点
            updaterFn && updaterFn(node, value, oldValue);
        });
    },

    // 事件处理
    eventHandler: function(node, vm, exp, dir) {
        //从指令名中得到事件类型（事件名） click
        var eventType = dir.split(':')[1],
          // 从配置对象中的methods中得到指定表达式对应的事件回调函数
            fn = vm.$options.methods && vm.$options.methods[exp];
        // 如果都存在
        if (eventType && fn) {
            // 给节点绑定指定事件名和回调函数（必须通过bind()强制绑定this为vm）的DOM事件监听
           // bind()在这里做了两件事：1、this绑定为vm,2、返回与原函数一样的函数
            node.addEventListener(eventType, fn.bind(vm), false);
        }
    },
    // 从vm中得到表达式所对应的值
    _getVMVal: function(vm, exp) {
        var val = vm._data;
        // 这里之所以写得这么复杂是因为表达式有可能是多层的，如a.b.c
        exp = exp.split('.');
        exp.forEach(function(k) {
            val = val[k];
        });
        return val;
    },

    _setVMVal: function(vm, exp, value) {
        var val = vm._data;
        exp = exp.split('.');
        exp.forEach(function(k, i) {
            // 非最后一个key，更新val的值
            if (i < exp.length - 1) {
                val = val[k];
            } else {
                val[k] = value;
            }
        });
    }
};

//包含多个更新节点的方法的工具对象
var updater = {
    //更新节点的textContent属性
    textUpdater: function(node, value) {
        node.textContent = typeof value == 'undefined' ? '' : value;
    },
  //更新节点的innerHTML属性
    htmlUpdater: function(node, value) {
        node.innerHTML = typeof value == 'undefined' ? '' : value;
    },
  //更新节点的className属性
    classUpdater: function(node, value, oldValue) {
        // 得到静态的class属性的值
        var className = node.className;
       /* className = className.replace(oldValue, '').replace(/\s$/, '');
        var space = className && String(value) ? ' ' : '';
        node.className = className + space + value;*/
      // 将静态的calss属性值与动态的class值进行合并后设置为新的calssName属性值
      node.className = className + (className ? ' ' : '') + value;
    },
  //更新节点的vaule属性值
    modelUpdater: function(node, value, oldValue) {
        node.value = typeof value == 'undefined' ? '' : value;
    }
};