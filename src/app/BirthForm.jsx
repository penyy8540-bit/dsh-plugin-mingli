import React from 'react';

/**
 * 出生信息表单（新建 / 编辑）。
 * 输入全部为纯前端状态，提交时交给 App -> store.upsertProfile()。
 *
 * props:
 *   initial  { name, gender, solar, birthplace, longitude, use_true_solar, id? }
 *   onSubmit(profilePatch)
 *   onCancel()
 */

const DEFAULT_FORM = {
  name: '',
  gender: 'male',
  date: '',
  time: '12:00',
  birthplace: '',
  longitude: '',
  use_true_solar: true,
};

function splitSolar(solar) {
  const matched = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(solar || ''));
  return { date: matched?.[1] || '', time: matched?.[2] || '12:00' };
}

function buildInitial(initial) {
  if (!initial) return { ...DEFAULT_FORM };
  const parts = splitSolar(initial.solar);
  return {
    name: initial.name || '',
    gender: initial.gender === 'female' ? 'female' : 'male',
    date: parts.date,
    time: parts.time,
    birthplace: initial.birthplace || '',
    longitude: initial.longitude === null || initial.longitude === undefined ? '' : String(initial.longitude),
    use_true_solar: initial.use_true_solar !== false,
  };
}

export default function BirthForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = React.useState(() => buildInitial(initial));
  const [errors, setErrors] = React.useState({});

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = (event) => {
    if (event) event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = '请填写姓名（可用化名）';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = '请选择公历出生日期';
    else if (Number.isNaN(new Date(`${form.date}T${form.time || '12:00'}`).getTime())) next.date = '日期不合法';
    if (!/^\d{2}:\d{2}$/.test(form.time)) next.time = '请选择出生时间';
    const lonRaw = String(form.longitude).trim();
    if (lonRaw !== '') {
      const lon = Number(lonRaw);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) next.longitude = '经度需在 -180 ~ 180 之间';
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    const longitude = lonRaw === '' ? null : Number(lonRaw);
    onSubmit?.({
      id: initial?.id,
      name: form.name.trim(),
      gender: form.gender,
      solar: `${form.date}T${form.time}`,
      birthplace: form.birthplace.trim(),
      longitude,
      use_true_solar: Boolean(form.use_true_solar),
    });
  };

  const field = (label, key, node, hint, error) =>
    React.createElement(
      'div',
      { className: 'ml-field' },
      React.createElement('label', { className: 'ml-label', htmlFor: `ml-${key}` }, label),
      node,
      error ? React.createElement('div', { className: 'ml-field-error' }, error) : null,
      hint && !error ? React.createElement('div', { className: 'ml-field-hint' }, hint) : null,
    );

  const input = (key, props) =>
    React.createElement('input', {
      id: `ml-${key}`,
      className: 'ml-input',
      value: form[key],
      onChange: (e) => set(key, e.target.value),
      ...props,
    });

  return React.createElement(
    'form',
    {
      className: 'ml-form-wrap',
      onSubmit: submit,
      noValidate: true,
      'aria-label': isEdit ? '编辑出生信息' : '新建命盘',
    },
    React.createElement(
      'div',
      { className: 'ml-form-head' },
      React.createElement(
        'button',
        { type: 'button', className: 'ml-back', onClick: onCancel, title: '返回档案列表', 'aria-label': '返回档案列表' },
        '←',
      ),
      React.createElement('div', { className: 'ml-form-title' }, isEdit ? '编辑出生信息' : '新建命盘'),
    ),
    React.createElement(
      'div',
      { className: 'ml-form-body ml-scroll' },
      field('姓名', 'name', input('name', { placeholder: '如：张三', autoComplete: 'off', maxLength: 24 }), '可填写化名，仅保存在本机', errors.name),
      React.createElement(
        'div',
        { className: 'ml-field' },
        React.createElement('span', { className: 'ml-label' }, '性别'),
        React.createElement(
          'div',
          { className: 'ml-seg', role: 'group', 'aria-label': '性别' },
          ['male', 'female'].map((value) =>
            React.createElement(
              'button',
              {
                key: value,
                type: 'button',
                className: 'ml-seg-btn',
                'data-on': form.gender === value ? 'true' : 'false',
                'aria-pressed': form.gender === value ? 'true' : 'false',
                onClick: () => set('gender', value),
              },
              value === 'male' ? '男 · 乾造' : '女 · 坤造',
            ),
          ),
        ),
      ),
      field('公历出生日期', 'date', input('date', { type: 'date', min: '1900-01-01', max: '2100-12-31' }), null, errors.date),
      field('出生时间', 'time', input('time', { type: 'time', step: 60 }), '不确定时可先用 12:00，时柱结论置信度会降低', errors.time),
      field('出生地', 'birthplace', input('birthplace', { placeholder: '如：北京', autoComplete: 'off', maxLength: 40 })),
      field(
        '经度（可选）',
        'longitude',
        input('longitude', { type: 'number', step: '0.1', min: '-180', max: '180', placeholder: '如：116.4' }),
        '东经为正、西经为负；留空按东经 120° 估算',
        errors.longitude,
      ),
      React.createElement(
        'label',
        { className: 'ml-switch', htmlFor: 'ml-true-solar' },
        React.createElement('span', null, '真太阳时校正'),
        React.createElement('input', {
          id: 'ml-true-solar',
          type: 'checkbox',
          checked: Boolean(form.use_true_solar),
          onChange: (e) => set('use_true_solar', e.target.checked),
        }),
      ),
      React.createElement(
        'div',
        { className: 'ml-field-hint' },
        form.use_true_solar
          ? '按经度与均时差换算真太阳时（推荐开启）'
          : '直接使用平太阳时（北京时间），不做经度校正',
      ),
    ),
    React.createElement(
      'div',
      { className: 'ml-form-foot' },
      React.createElement('button', { type: 'submit', className: 'ml-btn ml-btn--gold' }, isEdit ? '保存并重新排盘' : '保存并排盘'),
      React.createElement('button', { type: 'button', className: 'ml-btn ml-btn--ghost', onClick: onCancel }, '取消'),
    ),
  );
}
