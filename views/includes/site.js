window.addEventListener('load', () => {
  // handle search field
  document.getElementById('search').addEventListener('keyup', (e) => {
    e.preventDefault(); 
    if ((e.keyCode == 13))  {
      window.location.href='/?search=' + e.target.value
    }
  })
  //handle sorting selection
  document.getElementById('sort').addEventListener('change', (e) => {
    e.preventDefault(); 
    window.location.href='/?sort=' + e.target.value
  })
})