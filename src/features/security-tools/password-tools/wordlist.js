// Short, common, easy-to-type English words for passphrases. Deduplicated at runtime;
// entropy is always computed from the actual unique count.
const RAW = `
able acid aged also area army away baby back bake ball band bank barn base bath bead beam bean bear beat bell belt
bend best bike bird bite blue boat body bold bolt bone book boot born boss both bowl brave bread brick bride brief
bring broad brook brush build bulb bunch burst cabin cable cage cake calm camel camp canal candy cane cape card care
cargo carry cart case cash cast cave cedar chain chair chalk charm chart chase cheek chef chess chest chief child chip
cider city clamp clay clean clerk click cliff climb clock cloud clown club coach coal coast coat cocoa code coin cold
comet coral cord core corn couch cough count cover crab craft crane crate cream creek crew crisp crop crow crowd crown
cube cupid curl curve cycle daisy dance dark dash data dawn deal deck deer delta dense depth desk dial diary dice
diner dish disk dive dock dog doll dome door dove draft drama dream dress drift drill drink drive drum duck dune dust
eager eagle early earth easel echo edge eight elbow elder elf elk ember empty end epic equal error essay event exact
fable face fact fair fairy faith fall fame fancy farm fast fawn feast fern ferry fever fiber field fifty film final
finch fire firm fish five flag flame flash fleet flint float flock flood floor flour flute foam focus fog folk food
foot force forge fork form fort fox frame fresh frog frost fruit fuel fun fur gala game gate gear gecko gem ghost
giant gift giraffe glad glass globe glove glow glue goat gold golf good goose gown grace grain grand grape grass gravy
great green grid grill grin grip group grove guard guest guide guitar gulf gust habit hair half hall halo hammer hand
happy harbor hard harp hat hawk hazel head heart heat hedge helm help herb hero hill hint hippo hobby hold holly home
honey hood hook hope horn horse host hotel hour house hug human humor hunt husky ice icon idea igloo image inch index
ink inlet input iron island ivory ivy jacket jade jam jar jazz jeans jelly jet jewel job jog joke jolly judge juice
jump jungle kayak keen kettle key kid kind king kite kiwi knee knife knot koala lab lace ladder lake lamb lamp land
lane laser latch lava lawn layer leaf lemon lens level lever light lilac lily lime line linen lion list llama loaf
lobby local lock lodge logic loop lotus loud lucky lunar lunch lynx magic magnet maple marble march mask mason mayor
meadow medal melon menu merry metal meter midst mild mile milk mill mint mirror mist mixer model modem mole money
monk moon moose moral moss motel moth motor mouse mouth movie mud mug mural music myth nail name navy neck nest
net news nice night ninja noble noise north nose note novel nurse nut oak oasis ocean olive omega onion opal open
opera orbit orchid organ otter ounce oval oven owl owner oxide oyster paddle page paint palm panda panel paper parade
park parrot party pasta patch path peach pearl pecan pedal penny pepper piano pickle pie pier pilot pine pink pipe
pirate pixel pizza plain plane plant plate plaza plum poem poet polar pond pony pool poppy porch port poster potato
pouch power prism prize proof prose puma pump pupil puppy purse puzzle quail quake quartz queen quest quick quiet
quilt quiz rabbit radar radio raft rain ranch range rapid raven razor reef relay remix rhino ribbon rice ridge rifle
ring river road robin robot rock rocket roof room root rope rose rover royal ruby rug ruler rumor sable sail salad
salmon salt sand satin sauce scale scarf scene scout screen script sea seal season seed shade shark sheep shelf shell
shield shine ship shirt shoe shore silk silver siren skate ski sky slate sled slope smile smoke snack snail snake
snow soap sock sofa solar sonic soup space spark spice spider spoon sport spray spring sprout spur square squid stack
stage stair stamp star steam steel stem stick stone storm story stove straw stream street sugar suit summer sun swamp
swan sweet swift swing sword syrup table taco tail talon tango tank tape target taxi tea teal tempo tent thorn thumb
tiger tile timber toast token tomato tool topaz torch tower toy track trail train tree trend tribe trophy truck tulip
tuna tunnel turtle twig twin ultra umbrella uncle union unit urban user valley valve vapor vase velvet venus verse
vest video villa vine violet violin visa vivid vocal voice volt vote voyage wafer wagon walnut walrus wand wave wax
whale wheat wheel whistle wind window wing winter wire wisdom wolf wombat wood wool world worm yacht yard year yeti
yoga yogurt young zebra zero zest zinc zipper zone zoom
`;

export const WORDLIST = [...new Set(RAW.split(/\s+/).filter(Boolean))];
