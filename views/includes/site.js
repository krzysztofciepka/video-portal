window.addEventListener('load', () => {
  // handle search field
  if(document.getElementById('search')){
    document.getElementById('search').addEventListener('keyup', (e) => {
      e.preventDefault(); 
      if ((e.keyCode == 13))  {
        window.location.href='/videos?search=' + e.target.value
      }
    })
  }

  //handle sorting selection
  if(document.getElementsById('sort')){
    document.getElementById('sort').addEventListener('change', (e) => {
      e.preventDefault(); 
      window.location.href='?sort=' + e.target.value
    })
  }
})