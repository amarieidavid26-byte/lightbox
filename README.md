# Light Box 
Light Box is a 2d ray optics simulator that runs in browser. you place a mirror, lenses (convex and concave) and prisms on a canvas and you watch light ray bounce, bend and split into rainbows in real time.

i built this because i learnt about snell's law and cauchy's dispersion at school and wanted to see if i am capable of implementing them in an app to vizualize them.

try it here! https://lightbox-beta.vercel.app/

## what it does 
- place flat mirrors, curved mirrors (concave/convex), lenses and prisms
- laser beams and point light sources
- rays reflect off mirrors at phisically accurate angles
- white light splits into a rainbow thru the prisms (it loads with a beautiful rainbow dispersion) - scenario 1
- drag, rotate, delete any element using the tools in the left toolbar 
- 4 built-in demo scenes

## how the physics works 
reflection uses the standard formula `d_reflect = d - 2(d*n)n`. curved mirrors compute the normal at the hit point from the center of curvature.
refraction implements snell's law in vector form. total internal reflection kicks in automatically when the angle is too steep. lenses model both surfaces separately: ray enters, refracts, travels thru the glass, hits the exit surface, refracts again.
prism dispersion uses the cauchy equation `n(λ) = 1.522 + 0.00459/λ^2` to get slightly different refractive index for each wavelength. 

##built with 
- vanilla javascript + html canvas
- zero dependencies, no frameworks, no build tools
- all physics from scratch (no physics engine)

## run it locally 
```bash
git clone https://github.com/amarieidavid26-byte/lightbox.git
cd lightbox
npx serve .
```
open on localhost:3000
