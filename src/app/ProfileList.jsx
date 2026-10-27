import React from 'react';

/**
 * 左栏命主档案列表：选中 / 编辑 / 删除。
 *
 * props:
 *   profiles   Profile[]
 *   activeId   string | null
 *   onSelect(id)
 *   onEdit(profile)
 *   onDelete(id)
 */

function genderLabel(gender) {
  return gender === 'female' ? '女' : '男';
}

function formatSolar(solar) {
  const matched = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(String(solar || ''));
  if (!matched) return String(solar || '—');
  return matched[2] ? `${matched[1]} ${matched[2]}` : matched[1];
}

export default function ProfileList({ profiles = [], activeId = null, onSelect, onEdit, onDelete }) {
  const [armed, setArmed] = React.useState(null);

  React.useEffect(() => {
    setArmed((current) => (profiles.some((p) => p.id === current) ? current : null));
  }, [profiles]);

  if (!profiles.length) {
    return React.createElement(
      'div',
      { className: 'ml-list-empty' },
      React.createElement('div', { className: 'ml-list-empty-glyph', 'aria-hidden': 'true' }, '命'),
      React.createElement('div', { className: 'ml-list-empty-title' }, '还没有命主档案'),
      React.createElement('div', { className: 'ml-list-empty-hint' }, '填写出生信息后即可开始排盘'),
    );
  }

  return React.createElement(
    'div',
    { className: 'ml-profiles', role: 'list', 'aria-label': '命主档案' },
    profiles.map((profile) => {
      const active = profile.id === activeId;
      const isArmed = armed === profile.id;
      return React.createElement(
        'div',
        {
          key: profile.id,
          role: 'listitem',
          className: 'ml-profile',
          'data-active': active ? 'true' : 'false',
          'data-armed': isArmed ? 'true' : 'false',
          tabIndex: 0,
          'aria-current': active ? 'true' : undefined,
          onClick: () => onSelect?.(profile.id),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect?.(profile.id);
            }
          },
        },
        React.createElement(
          'div',
          { className: 'ml-profile-row' },
          React.createElement('span', { className: 'ml-profile-name' }, profile.name || '未命名命主'),
          React.createElement('span', { className: 'ml-profile-sex' }, genderLabel(profile.gender)),
        ),
        React.createElement(
          'div',
          { className: 'ml-profile-meta' },
          React.createElement('span', null, formatSolar(profile.solar)),
          profile.birthplace
            ? React.createElement('span', { className: 'ml-profile-dot' }, '·')
            : null,
          profile.birthplace ? React.createElement('span', null, profile.birthplace) : null,
        ),
        React.createElement(
          'div',
          {
            className: 'ml-profile-actions',
            onClick: (event) => event.stopPropagation(),
            onKeyDown: (event) => event.stopPropagation(),
          },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ml-icon-btn',
              title: '编辑出生信息',
              'aria-label': `编辑 ${profile.name || '未命名命主'} 的出生信息`,
              onClick: () => onEdit?.(profile),
            },
            '改',
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'ml-icon-btn ml-icon-btn--danger',
              title: isArmed ? '再次点击确认删除' : '删除该档案',
              'aria-label': isArmed ? '确认删除该档案' : `删除 ${profile.name || '未命名命主'} 的档案`,
              onClick: () => {
                if (isArmed) {
                  setArmed(null);
                  onDelete?.(profile.id);
                } else {
                  setArmed(profile.id);
                }
              },
            },
            isArmed ? '确认' : '删',
          ),
        ),
      );
    }),
  );
}
