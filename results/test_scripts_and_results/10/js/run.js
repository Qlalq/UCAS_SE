const { runCategory } = require('D:/VSCode/playwright/results/run_category.js');

const category = {
  "category": "十、个人设置",
  "feature": "个人设置",
  "test_cases": [
    {
      "name": "个人资料设置",
      "steps": [
        "以任何身份登录系统，进入设置",
        "上传头像，修改显示名称和其他信息"
      ],
      "expectation": "个人资料应被成功更新"
    },
    {
      "name": "偏好设置",
      "steps": [
        "以任何身份登录系统，进入设置",
        "修改语言、主题、默认视图等偏好"
      ],
      "expectation": "偏好设置应被成功保存并应用"
    },
    {
      "name": "账户设置",
      "steps": [
        "以任何身份登录系统，进入设置",
        "修改用户名和/或电子邮件地址"
      ],
      "expectation": "账户信息应被成功更新"
    },
    {
      "name": "认证设置",
      "steps": [
        "以任何身份登录系统，进入设置",
        "修改密码"
      ],
      "expectation": "密码应被成功更新"
    }
  ]
};

runCategory({
  category,
  resultDir: require('path').resolve(__dirname, '..'),
  categoryIndex: 10,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
