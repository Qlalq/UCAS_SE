const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "三、卡片核心功能",
  "feature": "卡片核心功能",
  "test_cases": [
    {
      "name": "创建/移动/删除卡片",
      "steps": [
        "看板中存在列表",
        "拖拽或菜单创建、移动、删除"
      ],
      "expectation": "操作均生效"
    },
    {
      "name": "卡片跨项目移动",
      "steps": [
        "卡片存在于某项目",
        "通过菜单选择跨项目移动"
      ],
      "expectation": "仅菜单方式可跨项目"
    },
    {
      "name": "子任务管理",
      "steps": [
        "卡片已创建",
        "添加、完成、删除子任务或设置截止日期"
      ],
      "expectation": "子任务状态正确更新"
    },
    {
      "name": "标签管理",
      "steps": [
        "卡片已创建",
        "创建、编辑标签或添加多标签"
      ],
      "expectation": "标签正确显示"
    },
    {
      "name": "成员分配",
      "steps": [
        "卡片已创建",
        "分配成员"
      ],
      "expectation": "仅显示看板成员"
    },
    {
      "name": "截止日期颜色指示",
      "steps": [
        "卡片设置了截止日期",
        "查看卡片"
      ],
      "expectation": ">2周灰，<2周黄，过期红"
    },
    {
      "name": "附件上传/设封面",
      "steps": [
        "卡片已创建",
        "上传图片并设为封面"
      ],
      "expectation": "图片显示为封面"
    },
    {
      "name": "计时器",
      "steps": [
        "卡片已创建",
        "开始/暂停计时器或手动编辑时间"
      ],
      "expectation": "计时器状态正确更新"
    },
    {
      "name": "卡片菜单操作",
      "steps": [
        "以任何身份登录系统，打开看板",
        "点击卡片上的省略号图标，使用菜单功能"
      ],
      "expectation": "菜单功能应正常工作"
    },
    {
      "name": "卡片视图操作",
      "steps": [
        "以任何身份登录系统，打开看板",
        "点击卡片打开卡片视图"
      ],
      "expectation": "应显示卡片详细信息，可编辑各项内容"
    },
    {
      "name": "卡片任务管理",
      "steps": [
        "以编辑者或以上权限的用户登录系统，打开卡片视图",
        "添加、编辑、删除任务，标记任务完成"
      ],
      "expectation": "任务应被正确管理，完成状态应更新"
    },
    {
      "name": "卡片附件管理",
      "steps": [
        "以编辑者或以上权限的用户登录系统，打开卡片视图",
        "添加、删除附件，设置附件为封面"
      ],
      "expectation": "附件应被正确管理，封面设置应生效"
    },
    {
      "name": "卡片评论管理",
      "steps": [
        "以评论者或以上权限的用户登录系统，打开卡片视图",
        "添加、编辑、删除评论"
      ],
      "expectation": "评论应被正确管理"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 3,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
