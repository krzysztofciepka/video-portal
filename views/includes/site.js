// handle search field

document.getElementById('search').addEventListener('click', (e) => {
    e.preventDefault(); 
})

document.getElementById('search').addEventListener('keyup', (e) => {
  e.preventDefault(); 
  if ((e.keyCode == 13))  {
    window.location.href='/?search=' + e.target.value
  }
})