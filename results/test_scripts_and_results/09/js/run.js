const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "九、列表管理",
  "feature": "列表管理",
  "test_cases": [
    {
      "name": "创建列表",
      "steps": [
        "以编辑者或以上权限的用户登录系统，打开看板",
        "点击\"+add list\"按钮，输入列表名称"
      ],
      "expectation": "列表应被成功创建"
    },
    {
      "name": "编辑列表",
      "steps": [
        "以编辑者或以上权限的用户登录系统，打开看板",
        "点击列表右上角的省略号图标，选择\"Edit list\""
      ],
      "expectation": "列表名称应可编辑并保存"
    },
    {
      "name": "删除列表",
      "steps": [
        "以编辑者或以上权限的用户登录系统，打开看板",
        "点击列表右上角的省略号图标，选择\"Delete list\"，确认删除"
      ],
      "expectation": "列表应被成功删除"
    },
    {
      "name": "列表导航",
      "steps": [
        "以任何身份登录系统，打开看板",
        "拖动列表改变位置，使用Shift+Scroll水平滚动"
      ],
      "expectation": "列表应能正确移动位置，滚动功能应正常"
    },
    {
      "name": "列表隐藏/显示",
      "steps": [
        "以任何身份登录系统，打开看板",
        "点击列表左上角的三角形按钮"
      ],
      "expectation": "列表应隐藏/显示，隐藏时应显示包含的卡片数量"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 9,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
