---
title_zh: "GPipe：把模型切段、把批次切片，用流水线并行训练超大网络"
title_en: "GPipe: Easy Scaling with Micro-Batch Pipeline Parallelism"
slug: p-24-gpipe
day: 24
segment: 补完
unit: "24_gpipe"
venue: "NeurIPS 2019"
source_version: "arXiv v5"
source_url: "https://arxiv.org/abs/1811.06965"
published: 2018-11-16
summary: "Google 的 Huang 等人 2018 年提出的流水线并行库：把任何“层序列”网络切成 K 段放到 K 个加速器上，每个小批量再切成 M 个微批量依次流过各段，梯度在小批量结束时同步更新，并重算激活以省显存。M ≥ 4K 时空等开销几乎可忽略。作者用它训练了 5.57 亿参数的图像模型和 60 亿参数的翻译模型。"
tags: [infrastructure, scaling-laws, transformer, ml-foundations]
reading_time: 9
authors_en: ["Yanping Huang", "Youlong Cheng", "Ankur Bapna", "Orhan Firat", "Mia Xu Chen", "Dehao Chen", "HyoukJoong Lee", "Jiquan Ngiam", "Quoc V. Le", "Yonghui Wu", "Zhifeng Chen"]
notes_updated: 2026-10-18
source_note: "arXiv 首版 2018-11-16，现行为第 5 版（2019-07-25），PDF 标注“Preprint. Under review.”。NeurIPS 2019 论文集收录时题为“GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism”，与 arXiv 现行版题目不同。本笔记依据 arXiv 现行版本撰写。"
---

## 一句话总结

模型太大、一块加速器放不下时，把网络按层切成几段分别放在不同设备上；为了不让设备轮流空等，再把一个批次切成很多微批次像流水线一样依次送入，最后一次性同步更新梯度。

## 解决什么问题

论文开头用两张图说明：图像分类和机器翻译的质量都随模型容量增长而提高（ImageNet 上代表性模型的容量增长了 36 倍）。但更大的模型会碰到硬件限制：单个加速器（GPU 或 TPU）的内存和设备之间的通信带宽有限，只能把模型切开放到多个设备上。

作者指出，高效的模型并行算法很难设计和实现，实践者往往要在“能扩到多大”“是否通用”“训练效率”之间取舍，结果大多数高效方案都只适用于特定结构和任务。GPipe 想做一个**与任务无关**的模型并行库：只要网络能写成一串层，就能扩展。

## 核心思想

### 1. 接口：层序列 + 两个数字

任何深度网络都可以看成 L 层的序列，每层有前向函数 f_i 和参数 w_i，用户还可以给出每层的计算代价估计 c_i。用户只需指定三样东西：分段数 **K**、微批次数 **M**、层的序列和定义。

GPipe 把连续的若干层合成一个“单元”（cell），第 k 个单元放在第 k 个加速器上，并在分段边界自动插入通信。切分算法尽量让各单元的估计代价方差最小，使各段计算时间接近。

### 2. 微批次流水线

朴素的模型并行有严重的利用率问题：由于层与层之间的顺序依赖，同一时刻只有一个设备在工作。GPipe 的做法：

- 前向时把大小为 N 的小批量切成 M 个相等的**微批次**，依次流过 K 个加速器，于是不同设备可以同时处理不同的微批次。
- 反向时，每个微批次的梯度都基于前向时使用的同一份参数计算。
- 小批量结束时，把 M 个微批次的梯度累加，一次性**同步**更新所有设备上的参数。

因此无论切成多少段，梯度更新都与不切分时一致，研究者加设备就能训更大的模型，不用担心优化行为改变。GPipe 也可以和数据并行组合使用。

### 3. 重算激活

为了降低激活值占用的显存，GPipe 支持**重算**（re-materialization）：前向时每个加速器只保存分段边界处的输出，反向时再重新计算本段的前向函数。峰值激活内存从不切分、不重算时的 `O(N × L)` 降到 `O(N + (L/K) × (N/M))`。

### 4. 空等开销

流水线开头和结尾会有一些设备空闲的时间，论文称为**气泡**（bubble）开销，分摊到 M 个微步上是 `O((K − 1) / (M + K − 1))`。实验中，当 **M ≥ 4K** 时气泡开销几乎可以忽略。

```anim
id: gpipe-bubble
component: pipeline-grid
caption: GPipe 流水线的气泡（理想化示意：各段耗时相同，不含重算和通信）
alt: 甘特图示意：纵轴是 K 个设备，横轴是时间。小批量切成 M 个微批次后，各设备错开一格依次处理，中间时段所有设备同时工作，开头和结尾呈阶梯状空白，即气泡。K = 4 时，M = 1 的空等占比是 75%，M = 16 时降到约 16%。最后所有设备同步更新参数。
params:
  K: { min: 1, max: 8, step: 1, default: 4, label: "设备数 K" }
  M: { min: 1, max: 32, step: 1, default: 4, label: "微批次数 M" }
  presets:
    - { label: "M = 1：没有流水线", M: 1 }
    - { label: "M = K", M: "K" }
    - { label: "M = 4K", M: "4K" }
  schedule:
    forward: "t = k + m"
    backward: "t = (M + K − 1) + (K − 1 − k) + (M − 1 − m)"   # 倒序，待核实
    final_column: 同步更新参数
  readouts:
    - { label: 总时间, formula: "2(M+K−1) 格" }
    - { label: 空等占比, formula: "(K−1)/(M+K−1)", format: percent1 }
    - { label: 理想加速比, formula: "K·M/(M+K−1)", format: fixed2, note: 笔者推导，不是论文数字 }
  fallback: [{ K: 4, M: 1 }, { K: 4, M: 16 }]
  reference: { K: 4, M: [1, 4, 8, 16, 32] }
  notes:
    - 理想化示意：各段耗时相同、前向与反向耗时相同，不含重算和通信
    - 论文写的是量级 O((K−1)/(M+K−1))
    - 论文实验：M ≥ 4K 时气泡几乎可以忽略（部分得益于重算可提前调度，本图未画）
steps:
  - text: 不切分时同一时刻只有一个设备在算，K = 4 时空等 75%
  - text: 切成 M = K 个微批次，中间时段所有设备同时忙，但灌满和排空仍有约 43% 空等
  - text: M = 4K 时降到约 16%；论文实验中几乎可以忽略，部分因为重算可以提前调度
  - text: 所有微批次的梯度累加后同步更新，结果与不切分一致
```

由于只在分段边界传递激活张量，通信量很小，即使设备之间没有高速互联也能高效扩展。

## 关键公式或机制

### 能扩多大（论文表 1）

- **AmoebaNet**（图像，8GB 显存的加速器）：不用 GPipe 时单设备最多 8200 万参数；单设备用 GPipe（靠重算和切批）可到 3.18 亿；8 个设备可到 18 亿，约为不用 GPipe 时的 25 倍。由于各层参数分布不均，扩展不是严格线性。
- **Transformer**（Cloud TPUv3，每核 16GB）：重算让单设备能训练 2.7 倍大的模型；128 段时可扩到 839 亿参数，是单设备的 298 倍。因为每层参数和输入大小相同，最大模型规模与设备数呈线性关系。

### 吞吐量（论文表 2、表 3）

- TPU 上，Transformer 在 M = 32 时，K 从 2 增到 8，归一化吞吐量从 1.8 到 6.3；论文概括为设备数增加到 4 倍时约 3.5 倍加速。AmoebaNet 因计算分布不均，加速低于线性。
- M = 1 时相当于没有流水线，无论用多少设备，吞吐量基本不变。
- 在没有 NVLink、只能走 PCI-E 的多块 P100 GPU 上，K 从 2 增到 8，AmoebaNet 加速 2.7 倍，Transformer 加速 3.3 倍，与有高速互联的 TPU 上的趋势相似。

### 两个应用

- **图像分类**：5.57 亿参数的 AmoebaNet-B(18, 512)，输入 480×480，切成 4 段，ImageNet-2012 单裁剪 top-1 84.4%、top-5 97%。迁移到 CIFAR-10 错误率 1%，CIFAR-100 错误率 8.7%。
- **多语言翻译**：语料覆盖 102 种语言到英语，共 250 亿个训练样本。单个 60 亿参数、128 层（编码器、解码器各 64 层）的 Transformer 同时学习所有语言对，在 100 个语言对上超过各自单独训练的 3.5 亿参数双语模型。从 4 亿参数扩到 13 亿提升明显，从 13 亿到 30 亿、60 亿仍有提升，但收益递减。
- **深 vs 宽**：参数同为 13 亿时，深模型和宽模型在高资源语言上相近，深模型在低资源语言上大幅领先，作者认为加深可能更利于泛化和迁移。
- **深模型训练不稳定**：预测会变得极其尖锐，出现非有限或很大的梯度。作者的对策是按层数缩小前馈层的初始化，并在 logit 超过某个值时截断。
- **大批量**：德英翻译的批量从 26 万 token 增大到 400 万 token，BLEU 从 30.92 升到 32.71。

## 图解

```mermaid
flowchart LR
    MB["小批量 N"] --> SPLIT["切成 M 个微批次"]
    SPLIT --> D1["加速器 1：第 1 段层"]
    D1 --> D2["加速器 2：第 2 段层"]
    D2 --> D3["……"]
    D3 --> DK["加速器 K：第 K 段层"]
    DK --> BW["各微批次反向传播：重算本段激活"]
    BW --> ACC["累加 M 个微批次的梯度"]
    ACC --> UPD["小批量结束时同步更新参数"]
```

图解：小批量切成 M 个微批次后依次流过 K 个加速器上的各段层，不同设备同时处理不同微批次；反向传播时各段重算自己的激活，所有微批次的梯度累加后同步更新一次参数。

## 关键原话

> "gradient updates using GPipe are consistent regardless of the number of partitions"

## 和 Anthropic 笔记的对应

| Anthropic 笔记 | 对得上的地方 |
|---|---|
| [量化智能体编码评测中的基础设施噪声](../notes/infrastructure-noise.md) | 本文的实验显示，同一个模型在不同硬件配置（TPU 或无高速互联的 GPU、不同的微批次数）下吞吐量差别很大。那篇讲的是资源配置会改变智能体评测成绩。两者都提醒：基础设施不是中性的背景。只是类比：本文关心训练速度，那篇关心评测分数。 |
| [扩展 Managed Agents：把“大脑”和“双手”解耦](../notes/managed-agents.md) | GPipe 的卖点是把“模型怎么写”和“怎么切到多台设备上”分开，用户只描述层序列，并行细节交给库。Managed Agents 也是把智能体的不同部分解耦，让各部分可以独立扩展和替换。只是类比。 |

## 读的时候要注意

- **前提是单层放得下**：作者说明 GPipe 目前假设任意单层都能放进一个加速器的内存；BatchNorm 这类跨样本的层需要额外处理微批次统计量。
- **切分是启发式的**：各层显存和计算量不均衡时，负载会不平衡，AmoebaNet 的次线性加速就是例子。
- **硬件描述前后不一**：正文说 AmoebaNet 的规模实验在 8GB 显存的 Cloud TPUv2 上进行，表 1 的表头却写“NVIDIA GPUs (8GB each)”（待核实：以哪一处为准，论文未说明）。
- **翻译实验用内部语料**：250 亿样本的多语言语料和双语基线都是内部数据，外部无法复现。
- **与异步方案的取舍**：作者把 GPipe 与 PipeDream 对比：后者用异步更新提高利用率，但要在每个设备上保存多份参数版本；GPipe 用同步更新避免了“参数过时”，代价是存在气泡。

## 30u30 对应单元

- 30u30 的 [Day 24 单元](https://github.com/Ojhaharsh/30u30/tree/main/papers/24_gpipe)（仓库采用 CC BY-NC-ND 4.0，本笔记没有使用其内容）。
- 路线位置：[30u30 导读](../resources/r-30u30.md) 的补完段，单元 5（Day 23 → 24 → 28）。

## 延伸阅读

- [Day 25：神经语言模型的规模定律](./p-25-scaling-laws.md)：为什么要训练越来越大的模型。
- [Day 22：Deep Speech 2](./p-22-deep-speech-2.md)：另一种多设备训练思路，用同步数据并行。
- [Day 13：Attention Is All You Need](./p-13-attention-is-all-you-need.md)：本文翻译实验用的 Transformer 结构。
- [Day 21：神经消息传递](./p-21-neural-message-passing.md)：其中的“多塔”变体同样是为了在算力和显存受限时扩大模型。

---

*本笔记依据 2026-10-18 抓取的在线原文撰写，仅为导读与总结。原文：Yanping Huang, Youlong Cheng, Ankur Bapna, Orhan Firat, Mia Xu Chen, Dehao Chen, HyoukJoong Lee, Jiquan Ngiam, Quoc V. Le, Yonghui Wu, Zhifeng Chen,[《GPipe: Easy Scaling with Micro-Batch Pipeline Parallelism》](https://arxiv.org/abs/1811.06965), NeurIPS 2019。*
