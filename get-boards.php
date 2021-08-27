<?php
    $output = '';
    $fileList = glob('boards/*');
    # combine all filenames separated by @
    foreach ($fileList as $file){
        $output .= substr($file,7) . '@';
    }
    echo $output;
?>
