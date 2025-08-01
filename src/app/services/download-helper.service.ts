import {Logger} from '../utils/logger';

/**
 * Service for helping download Bandcamp purchased tracks
 * Adds a button to generate a cURL script for batch downloading
 */
export class DownloadHelperService {
  private button: HTMLButtonElement;
  private observer: MutationObserver;

  constructor() {
    this.observer = new MutationObserver(this.mutationCallback.bind(this));
  }

  /**
   * Initialize the download helper
   */
  public init(): void {
    this.createButton();
    this.checkDownloadLinks();
    
    // Simple observer - just watch for href changes on download links
    const config = { attributes: true, attributeFilter: ['href'] };
    
    // Only observe existing download links, not the whole page
    const existingLinks = document.querySelectorAll('a[href*="/download/"], .download-title .item-button');
    existingLinks.forEach(link => {
      this.observer.observe(link, config);
    });
    
    // Single fallback check after 2 seconds for slow-loading pages
    setTimeout(() => {
      this.checkDownloadLinks();
    }, 2000);
  }

  /**
   * Create the download button and add it to the page
   */
  private createButton(): void {
    if (this.button) {
      return;
    }

    // Check for bulk download structure first, then single item
    const bulkContainer = document.querySelector('.download-titles');
    const singleContainer = document.querySelector('.download-item-container');
    
    let location: Element | null = null;
    
    if (bulkContainer) {
      // Bulk download page - place button in the download-titles container
      location = bulkContainer;
      Logger.debug('Placing button in bulk container (.download-titles)');
    } else if (singleContainer) {
      // Single download page - place button in the download-item-container
      location = singleContainer;
      Logger.debug('Placing button in single container (.download-item-container)');
    }
    
    if (!location) {
      Logger.debug('No suitable location found for download button');
      return;
    }

    this.button = document.createElement('button');
    this.button.title = "Generates a file for automating downloads using 'cURL'";
    this.button.className = 'bandcamp-workflow-download-all';
    this.button.disabled = true;
    this.button.textContent = 'Preparing download...';

    location.append(this.button);
    Logger.debug('Download button created and added to page');
  }

  /**
   * Enable the download button when all links are ready
   */
  private enableButton(): void {
    if (!this.button) {
      return;
    }
    
    this.button.disabled = false;
    this.button.textContent = 'Download curl script';
    
    this.button.addEventListener('click', () => {
      const date = this.formatDate();
      const downloadList = this.generateDownloadList();
      const preamble = this.getDownloadPreamble();
      const postamble = this.getDownloadPostamble();
      const downloadDocument = preamble + downloadList + postamble;
      
      this.downloadFile(`bandcamp_${date}.txt`, downloadDocument);
    });
  }

  /**
   * Disable the download button when links are not ready
   */
  private disableButton(): void {
    // Clone the button to remove event listeners
    if (this.button && this.button.parentNode) {
      const newButton = this.button.cloneNode(true) as HTMLButtonElement;
      this.button.parentNode.replaceChild(newButton, this.button);
      this.button = newButton;
    }
    
    this.button.disabled = true;
    this.button.textContent = 'Preparing download...';
  }

  /**
   * Check if download links are ready
   */
  private checkDownloadLinks(): void {
    this.mutationCallback();
  }

  /**
   * Callback for MutationObserver
   */
  private mutationCallback(): void {
    // Check for both bulk and single download links
    const bulkLinks = document.querySelectorAll('li.download_list_item .download-title .item-button[href]');
    const singleLinks = document.querySelectorAll('a[href*="/download/"]');
    
    const totalLinks = bulkLinks.length + singleLinks.length;
    
    Logger.debug(`Found ${bulkLinks.length} bulk links, ${singleLinks.length} single links`);
    
    if (totalLinks === 0) {
      return;
    }
    
    // Check if any links are ready (have valid href and not hidden)
    const allLinks = [...Array.from(bulkLinks), ...Array.from(singleLinks)];
    const readyLinks = allLinks.filter(link => {
      const href = link.getAttribute('href');
      const isVisible = (link as HTMLElement).style.display !== 'none';
      return href && href.length > 0 && isVisible;
    });
    
    Logger.debug(`Found ${readyLinks.length} ready links out of ${totalLinks} total`);
    
    if (readyLinks.length > 0) {
      this.enableButton();
    } else {
      this.disableButton();
    }
  }

  /**
   * Generate the list of download URLs
   */
  private generateDownloadList(): string {
    // Get download links using specific selectors for each page type
    const bulkLinks = document.querySelectorAll('li.download_list_item .download-title .item-button[href]');
    const singleLinks = document.querySelectorAll('a[href*="/download/"]');
    
    const urls = new Set<string>();
    
    // Add bulk download links
    bulkLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) urls.add(href);
    });
    
    // Add single download links  
    singleLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) urls.add(href);
    });
    
    if (urls.size === 0) {
      return 'URLS=()\n';
    }
    
    const fileList = Array.from(urls).map((url) => `\t"${url}"`).join('\n');
    return 'URLS=(\n' + fileList + '\n)\n';
  }

  /**
   * Format the current date for filename
   */
  private formatDate(): string {
    const currentdate = new Date();
    const year = String(currentdate.getFullYear()).slice(-2);
    const month = String(currentdate.getMonth() + 1).padStart(2, '0');
    const day = String(currentdate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Download a file with the given name and content
   */
  private downloadFile(filename: string, text: string): void {
    const element = document.createElement('a');
    
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text),
    );
    element.setAttribute('download', filename);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
  }

  /**
   * Get the preamble for the download script
   */
  private getDownloadPreamble(): string {
    return `#!/usr/bin/env bash

# Generated by Bandcamp Workflow Extension
#
# The following can be used to batch download your recent purchases.
# All downloaded files and extracted folders will be organized in a folder
# with the same name as this script (without the .txt extension).
# 
# Usage (Mac/Linux):
# 1) open Terminal
# 2) move to desired download directory (e.g. \`cd ~/Downloads/bandcamp\`)
# 3) run script (e.g. \`bash <this filename>.txt\` or \`. ./<this filename>.txt\`)

`;
  }

  /**
   * Get the postamble (implementation) for the download script
   */
  private getDownloadPostamble(): string {
    return `
# Configuration
DEFAULT_BATCH_SIZE=3

# Function to download a file silently, with minimal output
download_file() {
    local url="$1"
    local file_id="$2"
    local filename=$(basename "$url" | sed 's/\\?.*//')
    
    # Use curl with silent mode, only showing errors
    # -L: follow redirects
    # -O: save with remote filename
    # -J: use content-disposition header filename if available
    # -s: silent mode
    if curl -L -O -J -s "$url"; then
        return 0
    else
        return 1
    fi
}

# Function to organize all downloaded files into the base folder
organize_downloaded_files() {
    echo ""
    echo "=== Organizing downloaded files ==="
    
    # Get the script name without extension to use as base folder name
    SCRIPT_NAME=$(basename "$0" .txt)
    BASE_FOLDER="$SCRIPT_NAME"
    
    # Create the base folder if it doesn't exist
    mkdir -p "$BASE_FOLDER"
    
    # Move all downloaded files to the base folder
    echo "Moving downloaded files to $BASE_FOLDER/"
    MOVED_COUNT=0
    for file in *.zip *.flac *.mp3 *.wav *.m4a *.aiff *.ogg; do
        if [ -f "$file" ]; then
            mv "$file" "$BASE_FOLDER/" 2>/dev/null && ((MOVED_COUNT++))
        fi
    done
    
    if [ $MOVED_COUNT -gt 0 ]; then
        echo "Moved $MOVED_COUNT files to $BASE_FOLDER/"
    else
        echo "No audio files found to organize."
    fi
}

# Function to extract zip files in the current directory
extract_zip_files() {
    echo ""
    echo "=== Looking for zip files to extract ==="
    
    # Get the script name without extension to use as base folder name
    SCRIPT_NAME=$(basename "$0" .txt)
    BASE_FOLDER="$SCRIPT_NAME"
    
    # Check for zip files in the base folder
    cd "$BASE_FOLDER" 2>/dev/null || {
        echo "Base folder $BASE_FOLDER not found. No zip files to extract."
        return 0
    }
    
    # Count the number of zip files
    ZIP_COUNT=$(find . -maxdepth 1 -name "*.zip" | wc -l | tr -d ' ')
    
    if [ "$ZIP_COUNT" -eq 0 ]; then
        echo "No zip files found to extract."
        cd ..
        return 0
    fi
    
    echo "Found $ZIP_COUNT zip files to extract."
    
    # Extract each zip file within the base folder
    EXTRACTED=0
    EXTRACT_FAILED=0
    
    for zip_file in *.zip; do
        # Skip if no zip files match the pattern
        [ "$zip_file" = "*.zip" ] && break
        
        # Create directory name from zip filename (remove .zip extension)
        dir_name="\${zip_file%.zip}"
        
        echo "Extracting: $zip_file to $dir_name/"
        
        # Create directory if it doesn't exist
        mkdir -p "$dir_name"
        
        if unzip -q "$zip_file" -d "$dir_name"; then
            echo "Successfully extracted $zip_file to $dir_name/"
            ((EXTRACTED++))
        else
            echo "Failed to extract $zip_file"
            ((EXTRACT_FAILED++))
            # Remove directory if extraction failed
            rmdir "$dir_name" 2>/dev/null
        fi
    done
    
    cd ..
    
    echo ""
    echo "=== Extraction complete: $EXTRACTED successful, $EXTRACT_FAILED failed ==="
    
    if [ "$EXTRACTED" -gt 0 ]; then
        echo "All files and extractions are in the '$BASE_FOLDER' folder"
    fi
}

# Variables
TOTAL_URLS=\${#URLS[@]}
COMPLETED=0
FAILED=0
BATCH_SIZE=\${1:-$DEFAULT_BATCH_SIZE}

# Instructions
if [ "$BATCH_SIZE" -eq "$DEFAULT_BATCH_SIZE" ] && [ -z "$1" ]; then
    echo "Note: You can set the number of concurrent downloads with: $0 <number>"
    echo "      For example: $0 5"
fi

echo ""
echo "=== Starting download of $TOTAL_URLS files (concurrent downloads: $BATCH_SIZE) ==="
echo ""

# Main download loop
for ((i=0; i<TOTAL_URLS; i+=BATCH_SIZE)); do
    pids=()
    
    # Start a batch of downloads
    for ((j=i; j<i+BATCH_SIZE && j<TOTAL_URLS; j++)); do
        file_id=$((j+1))
        download_file "\${URLS[j]}" "$file_id" &
        pids+=($!)
    done
    
    # Wait for all downloads in this batch to complete
    for pid in "\${pids[@]}"; do
        wait $pid
        status=$?
        if [ $status -eq 0 ]; then
            ((COMPLETED++))
        else
            ((FAILED++))
        fi
        
        # Print progress after each file completes
        percent=$((COMPLETED * 100 / TOTAL_URLS))
        echo "Progress: $COMPLETED/$TOTAL_URLS files ($percent%)"
    done
done

echo ""
if [ $FAILED -eq 0 ]; then
    echo "SUCCESS: Downloaded all $TOTAL_URLS files"
else
    echo "WARNING: $FAILED of $TOTAL_URLS files failed to download"
fi

# Organize all downloaded files into the base folder
organize_downloaded_files

# Extract any zip files that were downloaded
extract_zip_files

echo ""
# Use stty -echo to suppress input display, then read the key, then restore with stty echo
echo -n "Press any key to exit..."
stty -echo
read -n 1
stty echo
echo # Add a newline after the keypress

exit $FAILED
`;
  }
}
