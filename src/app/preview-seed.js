/**
 * 预览专用的人生轨迹种子数据（仅 preview 模式写入 store）。
 * 数据来源：out/timeline_demo.json（timeline 模块的验收 demo：4 个节点 + 1 个假设分支）。
 * 真实用户不会加载这份数据。
 */
export const PREVIEW_TIMELINE = {
  "version": 1,
  "profile_id": "p_867951",
  "branches": [
    {
      "id": "actual",
      "name": "实际人生",
      "kind": "actual",
      "parent": null,
      "color": "#b8860b",
      "assumptions": [],
      "nodes": [
        {
          "id": "n1",
          "year": 2012,
          "month": 9,
          "age": 22,
          "kind": "milestone",
          "title": "考入大学",
          "desc": "",
          "tags": [
            "学业"
          ],
          "source": "user",
          "confidence": "medium",
          "important": false
        },
        {
          "id": "n2",
          "year": 2016,
          "month": 6,
          "age": 26,
          "kind": "event",
          "title": "毕业入职",
          "desc": "",
          "tags": [
            "工作"
          ],
          "source": "user",
          "confidence": "high",
          "important": true
        },
        {
          "id": "n3",
          "year": 2019,
          "month": 3,
          "age": 29,
          "kind": "turning",
          "title": "换城市工作",
          "desc": "从北京搬到杭州",
          "tags": [
            "生活"
          ],
          "source": "user",
          "confidence": "medium",
          "important": false
        },
        {
          "id": "n4",
          "year": 2022,
          "month": 11,
          "age": 32,
          "kind": "decision",
          "title": "开始独立项目",
          "desc": "",
          "tags": [
            "事业"
          ],
          "source": "user",
          "confidence": "medium",
          "important": true
        }
      ]
    },
    {
      "id": "b_1",
      "name": "如果当年读研",
      "kind": "branch",
      "parent": "actual",
      "color": "#1565c0",
      "assumptions": [
        "2016 选择读研而非直接工作"
      ],
      "fork_year": 2016,
      "nodes": [
        {
          "id": "n5",
          "year": 2019,
          "month": 9,
          "age": 29,
          "kind": "milestone",
          "title": "硕士毕业进入研究所",
          "desc": "",
          "tags": [],
          "source": "model",
          "confidence": "low",
          "important": false
        }
      ]
    }
  ]
};
