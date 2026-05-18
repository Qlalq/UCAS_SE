# 列表管理功能测试报告

## 测试概述
- 测试时间：2026-05-26
- 测试环境：Windows 11, Edge 浏览器
- 测试网站：https://demo.4gaboards.com
- 测试账号：qianyongjie25@mails.ucas.ac.cn
- 测试看板：Learn 4ga Boards (Getting started 项目)
- 测试模块：九、列表管理

## 测试结果总览
| 测试点 | 测试结果 | 测试依据截图 | 备注 |
|--------|----------|--------------|------|
| 1.创建列表 | ✅ 测试通过 | test1_create_list.png | 成功创建"Test List A"列表 |
| 2.编辑列表 | ✅ 测试通过 | test2_edit_list.png | 名称修改为"Test List A Edited" |
| 3a.列表隐藏 | ✅ 测试通过 | test3_hide_list.png | 列表折叠，显示卡片数量 |
| 3b.列表显示 | ✅ 测试通过 | test3_show_list.png | 列表恢复展开 |
| 4.列表导航 | ✅ 测试通过 | test4_drag_list.png | Test List B 拖动到左侧 |
| 5.删除列表 | ✅ 测试通过 | test5_delete_list.png | Test List B 已从看板移除 |

---

## 测试点1：创建列表
- **Given**: 以编辑者权限登录系统，打开 "Learn 4ga Boards" 看板
- **When**: 点击 "+Dodaj listę" (Add List) 按钮，输入 "Test List A"，确认创建
- **Then**: 列表应被成功创建
- **实际结果**: 列表成功显示在看板中
- **结果**: ✅ 测试通过

## 测试点2：编辑列表
- **Given**: "Test List A" 列表已存在
- **When**: 点击列表右上角省略号 → "Edytuj nazwę" (Edit list)，改名为 "Test List A Edited"，保存
- **Then**: 列表名称应可编辑并保存
- **实际结果**: 列表名称成功更新
- **结果**: ✅ 测试通过

## 测试点3：列表隐藏/显示
- **Given**: "Test List A Edited" 列表已存在
- **When**: 点击列表左上角三角形按钮隐藏 → 再次点击恢复显示
- **Then**: 列表应隐藏/显示，隐藏时应显示包含的卡片数量
- **实际结果**: 列表正确折叠隐藏（显示 "0 kart" 卡片数量），再次点击后恢复展开
- **结果**: ✅ 测试通过

## 测试点4：列表导航（拖动改变位置）
- **Given**: 两个列表 "Test List A Edited" 和 "Test List B" 存在于看板中
- **When**: 拖动 "Test List B" 到 "Test List A Edited" 的左侧
- **Then**: 列表应能正确移动位置
- **实际结果**: 列表位置成功交换
- **结果**: ✅ 测试通过

## 测试点5：删除列表
- **Given**: "Test List B" 列表已存在
- **When**: 点击省略号 → "Usuń listę" (Delete list) → 确认删除
- **Then**: 列表应被成功删除
- **实际结果**: "Test List B" 成功从看板中移除
- **结果**: ✅ 测试通过

---

## 截图文件列表
[screenshots/list-management/test1_create_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test1_create_list.png>)
[screenshots/list-management/test2_edit_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test2_edit_list.png>)
[screenshots/list-management/test3_hide_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test3_hide_list.png>)
[screenshots/list-management/test3_show_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test3_show_list.png>)
[screenshots/list-management/test4_drag_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test4_drag_list.png>)
[screenshots/list-management/test5_delete_list.png](<C:\Users\Qlalq\Desktop\results\screenshots\list-management\test5_delete_list.png>)
