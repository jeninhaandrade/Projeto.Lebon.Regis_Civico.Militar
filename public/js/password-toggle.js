document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.dataset.passwordToggle);
  const icon = button.querySelector('i');

  if (!input || !icon) return;

  const atualizarEstado = () => {
    const senhaEscondida = input.type === 'password';

    button.classList.toggle('is-hidden', senhaEscondida);
    button.setAttribute('aria-label', senhaEscondida ? 'Mostrar senha' : 'Ocultar senha');
    icon.classList.toggle('bi-eye-slash', senhaEscondida);
    icon.classList.toggle('bi-eye', !senhaEscondida);
  };

  atualizarEstado();

  button.addEventListener('click', () => {
    const senhaEscondida = input.type === 'password';

    input.type = senhaEscondida ? 'text' : 'password';
    atualizarEstado();
  });
});
