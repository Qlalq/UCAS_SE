const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "八、管理员级功能",
  "feature": "管理员级功能",
  "test_cases": [
    {
      "name": "用户列表管理",
      "steps": [
        "管理员登录系统",
        "查看、编辑、删除用户"
      ],
      "expectation": "操作生效"
    },
    {
      "name": "授予/撤销管理员",
      "steps": [
        "管理员登录系统",
        "授予或撤销管理员权限"
      ],
      "expectation": "权限立即生效"
    },
    {
      "name": "实例设置",
      "steps": [
        "管理员登录系统",
        "修改注册开关或域名限制"
      ],
      "expectation": "设置生效"
    },
    {
      "name": "系统参数配置",
      "steps": [
        "管理员登录系统",
        "设置系统参数并保存"
      ],
      "expectation": "重启后配置生效"
    },
    {
      "name": "角色权限分配",
      "steps": [
        "管理员登录系统",
        "为用户分配角色权限"
      ],
      "expectation": "用户获得对应功能访问权"
    },
    {
      "name": "系统日志查看",
      "steps": [
        "管理员登录系统",
        "按时间、类型筛选查看日志"
      ],
      "expectation": "日志记录完整"
    },
    {
      "name": "系统资源监控",
      "steps": [
        "系统正常运行",
        "查看CPU、内存使用率"
      ],
      "expectation": "使用率正常，无内存泄漏"
    },
    {
      "name": "项目经理级别权限",
      "steps": [
        "以项目经理身份登录系统",
        "管理项目内内容，添加新成员，创建新看板"
      ],
      "expectation": "系统应允许执行所有操作"
    },
    {
      "name": "管理员级别权限",
      "steps": [
        "以管理员身份登录系统",
        "访问实例设置，创建新项目"
      ],
      "expectation": "系统应允许执行所有操作"
    },
    {
      "name": "管理员手动添加用户",
      "steps": [
        "管理员/普通用户登录",
        "管理员添加用户 / 普通用户尝试添加"
      ],
      "expectation": "管理员可添加，普通用户不可"
    },
    {
      "name": "修改用户信息",
      "steps": [
        "以管理员身份登录系统，进入实例设置",
        "点击用户行的铅笔图标，修改用户信息并保存"
      ],
      "expectation": "用户信息应被成功更新"
    },
    {
      "name": "查看账户活动",
      "steps": [
        "以管理员身份登录系统，进入实例设置",
        "点击用户行的铅笔图标，查看账户活动"
      ],
      "expectation": "应显示账户创建时间和信息更新时间"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 8,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
