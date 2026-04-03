# privacy-mosaic

[English README](./README.md)

Privacy Mosaic 是一个 [Obsidian](https://obsidian.md) 插件，用来为文本和图片添加模糊或马赛克式遮盖，适合隐藏隐私信息、敏感截图或暂时不想直接展示的内容。插件使用 `++content++` 语法，并支持悬停显示和双击显示两种交互方式。

![Demo 演示](assets/demo.gif)

## 功能特性

- 面向隐私保护的文本与图片遮盖
- 使用简单的 `++content++` 语法包裹内容
- 同时支持 Reading mode 和 Live Preview
- 支持悬停显示或双击显示
- 可调整模糊强度和过渡动画时长
- 提供“包裹选中内容”和“显示或隐藏全部遮盖”命令

## 使用方法

### 基本语法

```markdown
这是普通文本，++这是被遮盖的文本++。

这是被遮盖的图片：++![[photo.png]]++

这是被遮盖的外链图片：++![[photo.png]](https://photo.png)++

多个内容也可以一起使用：++秘密 A++ 和 ++秘密 B++
```

### 命令

| 命令 | 说明 |
| --- | --- |
| `Toggle mosaic on selection` | 为当前选中文本添加或移除 `++...++` |
| `Reveal/hide all mosaic` | 显示或隐藏当前视图中的全部遮盖内容 |

你可以在 `设置 -> 快捷键` 中搜索 `Privacy Mosaic`，为这些命令分配快捷键。

### 设置项

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| Enable in editing mode | 开启 | 是否在 Live Preview 中启用遮盖 |
| Reveal mode | Hover | 通过悬停或双击显示内容 |
| Blur strength | 8px | 模糊强度，范围 `1` 到 `20` |
| Transition duration | 200ms | 动画时长，范围 `0` 到 `500` 毫秒 |



## 许可证

[MIT](./LICENSE)
