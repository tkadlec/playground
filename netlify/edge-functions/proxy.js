import { Context } from "netlify:edge";

function cookieVal(source, name) {
    const value = `; ${source}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
}
  
  
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
});
// general swap recipe
// expected syntax is:
// expects swap:=pattern|replacement|useRegexp|flags
// pattern and replacement are required for it to run. 
// useRegexp is false and optional. 
// If pattern is a regexp, set useRegexp to true. 
// flags optional, default is "gi"
// all pattern, replacement will be passed through decodeURIComponent before use, allowing complex strings. Optionally, use encodeURIComponent for most input.
// For example: Opti[^e]+ should be sent as Opti%5B%5Ee%5D%2B
function swapRecipe( recipeIngredients, response, responseText ){
    recipeIngredients.forEach( (ingredient) => {
      let parts = ingredient.split("|");
      let pattern, replacement, useRegexp;
      let flags = "gi";
  
      if(parts[0]){
        pattern = decodeURIComponent( parts[0] );
      }
      if(parts[1]){
        replacement = decodeURIComponent( parts[1] );
      }
      // if 3rd arg is true, the pattern should be a regexp 
      if(parts[2]){
        // first check if 4th arg is present to override regexp flags
        if( parts[3]){
          flags = decodeURIComponent( parts[3] );
        }
        pattern = new RegExp( pattern, flags);
      }
      
      if( pattern && replacement){
        responseText = responseText.replaceAll(pattern, replacement);
        response = new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
  
    } );
    return response;
  }
export default async(request, context) => {
  const url = new URL(request.url);
    // Disallow crawlers

    if (url.pathname === "/robots.txt") {
        return new Response('User-agent: *\nDisallow: /', { status: 200 });
    }

    // When overrideHost is used in a script, WPT sets x-host to original host i.e. site we want to proxy
    const host = request.headers.get('x-host');


      // Error if x-host header missing
  if (!host) {
    return new Response('x-host header missing', { status: 403 });
  }
  url.hostname = host;
    let recipes = request.headers.get('x-recipes');

    const recipeList = recipes ? recipes.split(";") : [];
    const acceptHeader = request.headers.get('accept');

    if (acceptHeader && acceptHeader.indexOf('text/html') >= 0) {
        let response = await fetch(url.toString(), request);
        let responseText = await response.text();
        let newResponse = new Response(responseText, response);
        newResponse.headers.delete("content-security-policy");
        response = newResponse;

        for( var i = 0; i < recipeList.length; i++ ){
            let recipe = recipeList[i];
            let recipeType = recipe.split(":=")[0];
            let recipeIngredients = recipe.split(":=")[1] ? recipe.split(":=")[1].split(',') : false;
            
            // general swap recipe!
      if (recipeType === 'swap' && recipeIngredients.length) {
        response = swapRecipe( recipeIngredients, response, responseText );
      }
        }

        return response;
    }
    
    return fetch(url.toString(), request)
};