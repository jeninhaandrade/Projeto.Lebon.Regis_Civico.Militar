document.addEventListener('DOMContentLoaded', () => {
  const toggleSidebar = document.getElementById('toggleSidebar');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');

  if (!toggleSidebar || !sidebar || !mainContent) {
    console.log('Elementos da sidebar não encontrados.');
    return;
  }

  toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-collapsed');
    mainContent.classList.toggle('expanded');

    const icon = toggleSidebar.querySelector('i');

    if (sidebar.classList.contains('sidebar-collapsed')) {
      icon.classList.remove('bi-x-lg');
      icon.classList.add('bi-list');
    } else {
      icon.classList.remove('bi-list');
      icon.classList.add('bi-x-lg');
    }
  });
});